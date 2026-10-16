-- «Из Ленивца в Миллионеры»: уведомления на айфон (Web Push).
-- На Android звонит будильник из APK, а айфон получает пуш в то же время.
-- Любой телефон аккаунта присылает расписание будильников (ldm_push_plan),
-- айфон — свою подписку на пуши (ldm_push_subscribe). Раз в минуту pg_cron
-- вызывает ldm.push_tick(): он кладёт наступившие будильники в очередь и,
-- если есть что отправить, зовёт Edge Function ldm-push — она шифрует и шлёт.
-- Отправленное ldm-push хранит 3 дня и сама чистит; подписку, которой больше нет
-- (служба пушей ответила 404/410 — уведомления выключили или приложение удалили), убирает тоже она.
-- В базе применено шагами: ldm_push_extensions, ldm_push_cron, ldm_push_tables, ldm_push_poke,
-- ldm_push_plan_test, ldm_push_tick_subscribe, ldm_push_schedule, ldm_push_daily_housekeeping —
-- итог тот же, что в этом файле.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ключи VAPID создаёт сама функция ldm-push при первом запуске; cron_token — пароль между базой и функцией
create table ldm.push_cfg (
  id int primary key default 1 check (id = 1),
  vapid_pub text,
  vapid_jwk jsonb,
  cron_token text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into ldm.push_cfg default values;

-- подписки устройств (айфон, браузер): адрес службы пушей и ключи шифрования
create table ldm.push_subs (
  endpoint text primary key,
  account_id uuid not null references ldm.accounts(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_ok timestamptz
);
create index on ldm.push_subs(account_id);

-- расписание будильников аккаунта — тот же список, что APK ставит на Android:
-- [{ dow 0–6 (0 — воскресенье), min — минуты от полуночи, title, text, skip/only: 'YYYY-MM-DD' }]
create table ldm.push_plans (
  account_id uuid primary key references ldm.accounts(id) on delete cascade,
  tz text,
  off int not null default 0,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- что уже отправлено сегодня — чтобы один будильник не пришёл дважды
create table ldm.push_sent (
  account_id uuid not null references ldm.accounts(id) on delete cascade,
  k text not null,
  day date not null,
  primary key (account_id, k, day)
);

-- очередь пушей для функции ldm-push
create table ldm.push_outbox (
  id bigserial primary key,
  account_id uuid not null references ldm.accounts(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  tries int not null default 0,
  result text
);
create index on ldm.push_outbox(created_at) where sent_at is null;
create index on ldm.push_outbox(account_id);

alter table ldm.push_cfg enable row level security;
alter table ldm.push_subs enable row level security;
alter table ldm.push_plans enable row level security;
alter table ldm.push_sent enable row level security;
alter table ldm.push_outbox enable row level security;
revoke all on all tables in schema ldm from public, anon, authenticated;
revoke all on all sequences in schema ldm from public, anon, authenticated;

-- разбудить функцию отправки (асинхронно, через pg_net)
create function ldm.push_poke() returns void
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  select cron_token into t from ldm.push_cfg where id = 1;
  perform net.http_post(
    url := 'https://lgsharkholmydihgtvis.supabase.co/functions/v1/ldm-push',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-token', t),
    timeout_milliseconds := 30000);
end $$;

-- раз в минуту: какие будильники наступили по местному времени аккаунта → очередь → функция ldm-push
create function ldm.push_tick() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with cur as (
    select p.account_id, p.items, lt::date as day, extract(dow from lt)::int as dow,
           extract(hour from lt)::int * 60 + extract(minute from lt)::int as m
      from ldm.push_plans p
     cross join lateral (select case when p.tz is not null then now() at time zone p.tz
                                     else (now() at time zone 'UTC') + make_interval(mins => p.off) end as lt) t
     where exists (select 1 from ldm.push_subs s where s.account_id = p.account_id)
  ), items as (
    select c.account_id, c.day, it,
           md5(coalesce(it->>'title', '') || '|' || (it->>'dow') || '|' || (it->>'min')) as k
      from cur c
     cross join lateral jsonb_array_elements(c.items) it
     where (it->>'dow')::int = c.dow
       -- окно 3 минуты: если запуск по расписанию опоздал, будильник всё равно придёт
       and (it->>'min')::int between c.m - 2 and c.m
       and coalesce(it->>'skip', '') <> to_char(c.day, 'YYYY-MM-DD')
       and coalesce(nullif(it->>'only', ''), to_char(c.day, 'YYYY-MM-DD')) = to_char(c.day, 'YYYY-MM-DD')
  ), due as (
    select distinct on (account_id, k) * from items order by account_id, k
  ), fresh as (
    insert into ldm.push_sent(account_id, k, day)
    select account_id, k, day from due
    on conflict do nothing
    returning account_id, k, day
  )
  insert into ldm.push_outbox(account_id, payload)
  select d.account_id, jsonb_build_object('title', d.it->>'title', 'body', coalesce(d.it->>'text', ''), 'tag', d.k, 'open', d.it->>'title')
    from due d join fresh f using (account_id, k, day);
  get diagnostics n = row_count;

  -- раз в сутки (03:07 UTC) ldm-push просыпается и без пушей — убрать старое (в том числе журнал этого расписания)
  if exists (select 1 from ldm.push_outbox where sent_at is null and tries < 3 and created_at > now() - interval '1 hour')
     or (extract(hour from now() at time zone 'UTC') = 3 and extract(minute from now() at time zone 'UTC') = 7) then
    perform ldm.push_poke();
  end if;
  return n;
end $$;

revoke all on function ldm.push_poke() from public, anon, authenticated;
revoke all on function ldm.push_tick() from public, anon, authenticated;

-- открытый ключ VAPID для PushManager.subscribe
create function public.ldm_push_key() returns jsonb
language sql security definer set search_path = '' as $$
  select case when vapid_pub is null then jsonb_build_object('ok', false, 'error', 'not_ready')
              else jsonb_build_object('ok', true, 'key', vapid_pub) end
    from ldm.push_cfg where id = 1
$$;

-- подписать это устройство на пуши аккаунта (повторно — просто обновляет).
-- Выключил уведомления или удалил приложение — служба пушей отвечает 410, и ldm-push сама убирает подписку.
create function public.ldm_push_subscribe(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid := ldm.account_of(p_token);
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  -- только настоящие службы пушей: Apple, Google, Mozilla, Microsoft
  if coalesce(p_endpoint, '') !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/'
     or length(p_endpoint) > 1024
     or coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_+/-]{86,88}={0,2}$'
     or coalesce(p_auth, '') !~ '^[A-Za-z0-9_+/-]{21,24}={0,2}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_subscription');
  end if;
  if (select count(*) from ldm.push_subs where account_id = a and endpoint <> p_endpoint) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many_devices');
  end if;
  insert into ldm.push_subs(endpoint, account_id, p256dh, auth, device)
  values (p_endpoint, a, p_p256dh, p_auth, left(coalesce(p_device, ''), 60))
  on conflict (endpoint) do update
    set account_id = excluded.account_id, p256dh = excluded.p256dh, auth = excluded.auth,
        device = excluded.device, created_at = now();
  return jsonb_build_object('ok', true, 'devices', (select count(*) from ldm.push_subs where account_id = a));
end $$;

-- расписание будильников аккаунта; p_tz — часовой пояс телефона, p_off — смещение в минутах на случай незнакомого пояса
create function public.ldm_push_plan(p_token text, p_items jsonb, p_tz text default null, p_off int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid := ldm.account_of(p_token); tz text := nullif(left(coalesce(p_tz, ''), 64), ''); clean jsonb;
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 400
     or octet_length(p_items::text) > 131072 then
    return jsonb_build_object('ok', false, 'error', 'bad_items');
  end if;
  if tz is not null then
    begin
      perform now() at time zone tz;
    exception when others then
      tz := null;
    end;
  end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'dow', (it->>'dow')::int,
           'min', (it->>'min')::int,
           'title', left(coalesce(it->>'title', ''), 120),
           'text', left(coalesce(it->>'text', ''), 300),
           'skip', case when it->>'skip' ~ '^\d{4}-\d{2}-\d{2}$' then it->>'skip' end,
           'only', case when it->>'only' ~ '^\d{4}-\d{2}-\d{2}$' then it->>'only' end))), '[]'::jsonb)
    into clean
    from jsonb_array_elements(p_items) it
   where case when jsonb_typeof(it) = 'object' and coalesce(it->>'dow', '') ~ '^[0-6]$' and coalesce(it->>'min', '') ~ '^\d{1,4}$'
              then (it->>'min')::int < 1440 else false end;
  insert into ldm.push_plans(account_id, tz, off, items, updated_at)
  values (a, tz, greatest(-840, least(840, coalesce(p_off, 0))), clean, now())
  on conflict (account_id) do update
    set tz = excluded.tz, off = excluded.off, items = excluded.items, updated_at = now();
  return jsonb_build_object('ok', true, 'n', jsonb_array_length(clean),
                            'devices', (select count(*) from ldm.push_subs where account_id = a));
end $$;

-- «Проверить»: пуш на все устройства аккаунта прямо сейчас (не чаще раза в 20 секунд)
create function public.ldm_push_test(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid := ldm.account_of(p_token); n int;
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select count(*) into n from ldm.push_subs where account_id = a;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'no_devices'); end if;
  if exists (select 1 from ldm.push_outbox where account_id = a and payload->>'tag' = 'test'
                and created_at > now() - interval '20 seconds') then
    return jsonb_build_object('ok', false, 'error', 'too_often');
  end if;
  insert into ldm.push_outbox(account_id, payload) values (a, jsonb_build_object(
    'title', '🔔 Уведомления работают',
    'body', 'Так будут приходить будильники: подъём, публикации, твои дела и уроки.',
    'tag', 'test', 'open', ''));
  perform ldm.push_poke();
  return jsonb_build_object('ok', true, 'devices', n);
end $$;

revoke all on function public.ldm_push_key() from public;
revoke all on function public.ldm_push_subscribe(text, text, text, text, text) from public;
revoke all on function public.ldm_push_plan(text, jsonb, text, int) from public;
revoke all on function public.ldm_push_test(text) from public;
grant execute on function public.ldm_push_key() to anon, authenticated;
grant execute on function public.ldm_push_subscribe(text, text, text, text, text) to anon, authenticated;
grant execute on function public.ldm_push_plan(text, jsonb, text, int) to anon, authenticated;
grant execute on function public.ldm_push_test(text) to anon, authenticated;

select cron.schedule('ldm-push-tick', '* * * * *', 'select ldm.push_tick()');
