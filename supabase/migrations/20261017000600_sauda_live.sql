-- «Sauda»: настоящие деньги и исправления после проверки.
--  • боевой режим: пополнение переводом на Kaspi / карту / по ссылке оплаты, администратор подтверждает поступление;
--    при выключении тестового режима тестовые деньги обнуляются, открытые тестовые сделки и заявки закрываются;
--  • вывод можно отменить, пока администратор не взял заявку в работу;
--  • фоновые задачи не запускаются дважды, автоподтверждение не трогает заказы со спором,
--    подписка продлевается только по цене, на которую согласился покупатель;
--  • споры не открываются бесконечно, модератор решает только споры, блокировка возвращает деньги покупателям мошенника;
--  • сессии живут 60 дней без входа, имена «под поддержку» запрещены.

-- ───────────── схема ─────────────
alter table sauda.topups add column if not exists code text not null default '';
alter table sauda.topups add column if not exists claimed_at timestamptz;
alter table sauda.topups add column if not exists note text not null default '';
alter table sauda.topups add column if not exists test boolean not null default false;
alter table sauda.topups drop constraint if exists topups_status_check;
alter table sauda.topups add constraint topups_status_check check (status in ('pending', 'paid', 'failed', 'canceled'));
create index if not exists topups_status_idx on sauda.topups(status, created_at);
update sauda.topups set test = true where not test and sauda.test_mode();

alter table sauda.withdrawals drop constraint if exists withdrawals_status_check;
alter table sauda.withdrawals add constraint withdrawals_status_check check (status in ('pending', 'processing', 'done', 'rejected', 'canceled'));

alter table sauda.orders add column if not exists disputes int not null default 0;
update sauda.orders set disputes = 1 where dispute_by is not null and disputes = 0;

alter table sauda.subs add column if not exists price bigint;
update sauda.subs s set price = l.price from sauda.lots l where l.id = s.lot_id and s.price is null;

insert into sauda.config(k, v) values
  ('pay_kaspi_phone', '""'),           -- номер Kaspi Gold, на который люди переводят пополнение
  ('pay_kaspi_name', '""'),            -- имя получателя, как его покажет Kaspi
  ('pay_card', '""'),                  -- номер карты для перевода (если нужен)
  ('pay_link', '""'),                  -- ссылка оплаты: Kaspi Pay / QR / платёжная страница
  ('pay_note', '""'),                  -- пояснение для покупателей
  ('live_since', 'null')
on conflict (k) do nothing;

create or replace function sauda.cfgs(p_k text) returns text
language sql stable security definer set search_path = '' as $$ select coalesce((select v #>> '{}' from sauda.config where k = p_k), '') $$;

-- реквизиты для пополнения (видны всем — это просто куда переводить)
create or replace function sauda.pay_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('phone', sauda.cfgs('pay_kaspi_phone'), 'name', sauda.cfgs('pay_kaspi_name'), 'card', sauda.cfgs('pay_card'),
                            'link', sauda.cfgs('pay_link'), 'note', sauda.cfgs('pay_note'))
$$;

create or replace function sauda.topup_json(x sauda.topups) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', x.id, 'amount', x.amount, 'method', x.method, 'status', x.status, 'code', x.code, 'note', x.note,
                            'test', x.test, 'claimed_at', x.claimed_at, 'created_at', x.created_at, 'paid_at', x.paid_at)
$$;

-- имя, похожее на поддержку или администрацию, — только у сотрудников (буквы-двойники кириллицы сводим к латинице)
create or replace function sauda.name_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (
      select 1 from unnest(array['support', 'admin', 'moderator', 'поддержк', 'админ', 'модер', 'гарант', 'арбитр']) w
      where strpos(x.nm, translate(w, 'аеорсухкмтві0', 'aeopcyxkmtbio')) > 0)
    and x.nm !~ '(^|[^a-z])sauda([^a-z]|$)'
  from (select translate(lower(coalesce(p, '')), 'аеорсухкмтві0', 'aeopcyxkmtbio') nm) x
$$;

-- ───────────── сессии: 60 дней без входа — выйти ─────────────
create or replace function sauda.uid(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a uuid; h text;
begin
  if coalesce(p_token, '') = '' then return null; end if;
  h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select user_id into a from sauda.sessions where token_hash = h and last_seen > now() - interval '60 days';
  if a is not null then
    update sauda.users set last_seen = now() where id = a and last_seen < now() - interval '1 minute';
    update sauda.sessions set last_seen = now() where token_hash = h and last_seen < now() - interval '1 hour';
  end if;
  return a;
end $$;

-- ───────────── возврат останавливает автопродление ─────────────
create or replace function sauda.refund(p_order bigint, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
declare o sauda.orders;
begin
  select * into o from sauda.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.status not in ('paid', 'delivered', 'dispute') then raise exception 'bad_status'; end if;
  update sauda.orders set status = 'refunded', closed_at = now(), complete_at = null, resolution = p_by where id = o.id;
  perform sauda.money(o.buyer, o.amount, 'refund', o.id, o.title);
  if not o.auto then
    update sauda.lots set
      qty = case when qty is null then null else qty + o.qty end,
      sold = greatest(sold - o.qty, 0),
      status = case when status = 'sold' then 'active' else status end
    where id = o.lot_id;
  else
    update sauda.lots set sold = greatest(sold - o.qty, 0) where id = o.lot_id;
  end if;
  if o.sub_id is not null then update sauda.subs set active = false where id = o.sub_id; end if;
  perform sauda.sys(o.buyer, o.seller, case when p_by = 'seller' then o.seller when p_by = 'buyer' then o.buyer else null end,
    jsonb_build_object('k', 'order_refunded', 'id', o.id, 'by', split_part(p_by, ':', 1), 'amount', o.amount), o.id);
  perform sauda.notify(o.buyer, 'order_refunded', jsonb_build_object('id', o.id, 'title', o.title, 'amount', o.amount), '#/order/' || o.id);
  if p_by <> 'seller' then
    perform sauda.notify(o.seller, 'order_refunded_s', jsonb_build_object('id', o.id, 'title', o.title, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  end if;
end $$;

-- ───────────── фоновые задачи ─────────────
create or replace function sauda.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n_done int := 0; n_sub int := 0; oid bigint; l sauda.lots; tm boolean := sauda.test_mode(); stop boolean;
begin
  -- cron и попутный запуск не работают одновременно — иначе подписка продлится дважды
  if not pg_try_advisory_xact_lock(4711001) then return jsonb_build_object('skipped', true); end if;

  -- строки блокируются и перепроверяются: заказ, по которому только что открыли спор, сюда не попадёт
  for r in select id from sauda.orders where status = 'delivered' and complete_at <= now()
           order by complete_at limit 300 for update skip locked loop
    perform sauda.complete(r.id, 'auto');
    n_done := n_done + 1;
  end loop;

  if tm then
    -- демо-продавцы (только в тестовом режиме) выполняют заказ сами
    for r in select o.id, o.buyer, o.seller from sauda.orders o join sauda.users s on s.id = o.seller
             where o.status = 'paid' and s.is_demo order by o.id limit 100 for update of o skip locked loop
      update sauda.orders set status = 'delivered',
             payload = 'DEMO-' || upper(encode(extensions.gen_random_bytes(3), 'hex')) || '-' || upper(encode(extensions.gen_random_bytes(3), 'hex')),
             delivered_at = now(), complete_at = now() + interval '10 minutes'
       where id = r.id and status = 'paid';
      perform sauda.sys(r.buyer, r.seller, r.seller, jsonb_build_object('k', 'order_delivered', 'id', r.id), r.id);
      perform sauda.notify(r.buyer, 'order_delivered', jsonb_build_object('id', r.id), '#/order/' || r.id);
    end loop;
    -- у демо-лотов с автовыдачей склад не кончается
    insert into sauda.lot_items(lot_id, payload)
    select l2.id, 'DEMO-' || upper(encode(extensions.gen_random_bytes(4), 'hex')) || '-' || g
    from sauda.lots l2 cross join generate_series(1, 20) g
    where l2.is_demo and l2.auto and l2.status in ('active', 'sold')
      and (select count(*) from sauda.lot_items i where i.lot_id = l2.id and i.order_id is null) < 5;
    update sauda.lots l2 set qty = (select count(*) from sauda.lot_items i where i.lot_id = l2.id and i.order_id is null),
           status = case when l2.status = 'sold' then 'active' else l2.status end
     where l2.is_demo and l2.auto and l2.status in ('active', 'sold')
       and (l2.status = 'sold' or l2.qty is distinct from (select count(*) from sauda.lot_items i where i.lot_id = l2.id and i.order_id is null));
  end if;

  for r in select s.* from sauda.subs s where s.active and s.next_at <= now() order by s.next_at limit 100 for update skip locked loop
    begin
      select * into l from sauda.lots where id = r.lot_id;
      -- продавец поднял цену — без согласия покупателя дороже не списываем
      if r.price is not null and l.price > r.price then raise exception 'price_changed'; end if;
      oid := sauda.place_order(r.buyer, r.lot_id, 1, r.buyer_data, r.id);
      update sauda.subs set next_at = greatest(r.next_at + make_interval(days => coalesce(l.period_days, 30)), now() + interval '1 hour'),
             last_order = oid, fails = 0, price = least(coalesce(price, l.price), l.price)
       where id = r.id;
      perform sauda.notify(r.buyer, 'sub_renewed', jsonb_build_object('order', oid, 'lot', r.lot_id), '#/order/' || oid);
      n_sub := n_sub + 1;
    exception when raise_exception then
      stop := r.fails + 1 >= 3 or sqlerrm in ('price_changed', 'lot_unavailable', 'banned');
      update sauda.subs set fails = fails + 1, next_at = now() + interval '1 day', active = not stop where id = r.id;
      perform sauda.notify(r.buyer, 'sub_failed', jsonb_build_object('lot', r.lot_id, 'error', sqlerrm, 'stopped', stop), '#/subs');
    end;
  end loop;

  delete from sauda.sessions where last_seen < now() - interval '60 days';
  -- неоплаченные заявки на пополнение без «Я оплатил» живут двое суток
  update sauda.topups set status = 'canceled', note = 'expired'
   where status = 'pending' and claimed_at is null and created_at < now() - interval '2 days';
  return jsonb_build_object('completed', n_done, 'renewed', n_sub);
end $$;

-- ───────────── запуск с настоящими деньгами ─────────────
-- один раз и навсегда: всё тестовое закрывается, балансы обнуляются, дальше на них только настоящие деньги
create or replace function sauda.go_live() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from sauda.orders where status in ('paid', 'delivered', 'dispute') order by id loop
    perform sauda.refund(r.id, 'system:live');
  end loop;
  for r in select id, user_id, amount from sauda.withdrawals where status in ('pending', 'processing') order by id for update loop
    update sauda.withdrawals set status = 'rejected', processed_at = now(), note = 'test' where id = r.id;
    perform sauda.money(r.user_id, r.amount, 'withdraw_back', r.id, 'test');
  end loop;
  update sauda.topups set status = 'canceled', note = 'test' where status = 'pending';
  update sauda.subs set active = false where active;
  update sauda.promos set uses_left = 0 where uses_left > 0;
  update sauda.users set pro_until = null where pro_until is not null;
  for r in select id, balance from sauda.users where balance <> 0 order by id loop
    perform sauda.money(r.id, -r.balance, 'test_reset', null, '');
  end loop;
  update sauda.config set v = to_jsonb(now()) where k = 'live_since';
  update sauda.config set v = 'false' where k = 'test_mode';
end $$;

-- ═════════════ вход: имя «как у поддержки» нельзя ═════════════
create or replace function public.sauda_register(p_login text, p_password text, p_name text default '', p_ref text default '', p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); n text := trim(coalesce(p_name, '')); u uuid; r uuid;
begin
  if l !~ '^[a-z0-9_.-]{3,24}$' then raise exception 'bad_login_format'; end if;
  if l in ('root', 'system', 'help', 'podderzhka', 'administrator') or not sauda.name_ok(l) then raise exception 'login_taken'; end if;
  if length(coalesce(p_password, '')) < 6 or length(p_password) > 72 then raise exception 'bad_password'; end if;
  if n = '' then n := l; end if;
  if length(n) > 32 then raise exception 'bad_name'; end if;
  if not sauda.name_ok(n) then raise exception 'name_reserved'; end if;
  if exists (select 1 from sauda.users where login = l) then raise exception 'login_taken'; end if;
  select id into r from sauda.users where ref_code = lower(trim(coalesce(p_ref, ''))) and not is_demo and role <> 'bot';
  begin
    insert into sauda.users(login, name, pass_hash, ref_by)
    values (l, n, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), r) returning id into u;
  exception when unique_violation then raise exception 'login_taken';
  end;
  if r is not null then perform sauda.notify(r, 'ref_joined', jsonb_build_object('login', l), '#/ref'); end if;
  perform sauda.post(sauda.chat_of(u, sauda.platform()), sauda.platform(), 'system', '{"k":"welcome"}');
  return jsonb_build_object('ok', true, 'token', sauda.new_session(u, p_device), 'login', l);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_profile_save(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; v_name text; v_bio text; v_city text; v_av text; v_lang text;
begin
  u := sauda.me(p_token);
  v_name := trim(coalesce(p->>'name', u.name));
  v_bio := trim(coalesce(p->>'bio', u.bio));
  v_city := trim(coalesce(p->>'city', u.city));
  v_av := coalesce(p->>'avatar', u.avatar);
  v_lang := coalesce(p->>'lang', u.lang);
  if length(v_name) < 1 or length(v_name) > 32 then raise exception 'bad_name'; end if;
  if v_name <> u.name and u.role not in ('admin', 'moder') and not sauda.name_ok(v_name) then raise exception 'name_reserved'; end if;
  if length(v_bio) > 600 then raise exception 'too_long'; end if;
  if length(v_city) > 40 then raise exception 'too_long'; end if;
  if v_av <> '' and (v_av !~ '^data:image/(png|jpeg|webp|gif);base64,' or length(v_av) > 60000) then raise exception 'bad_image'; end if;
  if v_lang not in ('ru', 'kz') then raise exception 'bad_input'; end if;
  update sauda.users set name = v_name, bio = v_bio, city = v_city, avatar = v_av, lang = v_lang where id = u.id;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ покупка: подписка запоминает цену ═════════════
create or replace function public.sauda_buy(p_token text, p_lot bigint, p_qty int default 1, p_data text default '', p_renew boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; oid bigint; sid bigint; pd int; pr bigint;
begin
  u := sauda.me(p_token);
  oid := sauda.place_order(u.id, p_lot, p_qty, p_data);
  select period_days, price into pd, pr from sauda.lots where id = p_lot;
  if coalesce(p_renew, false) and pd is not null then
    insert into sauda.subs(buyer, lot_id, buyer_data, active, next_at, last_order, price)
    values (u.id, p_lot, trim(coalesce(p_data, '')), true, now() + make_interval(days => pd), oid, pr)
    on conflict (buyer, lot_id) do update set active = true, buyer_data = excluded.buyer_data, next_at = excluded.next_at,
      last_order = oid, fails = 0, price = excluded.price
    returning id into sid;
    update sauda.orders set sub_id = sid where id = oid;
  end if;
  return jsonb_build_object('ok', true, 'order', oid, 'balance', (select balance from sauda.users where id = u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- включить автопродление снова — по нынешней цене лота
create or replace function public.sauda_sub_set(p_token text, p_id bigint, p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  update sauda.subs s set active = p_active, fails = 0,
         next_at = case when p_active then greatest(s.next_at, now()) else s.next_at end,
         price = case when p_active then (select l.price from sauda.lots l where l.id = s.lot_id) else s.price end
   where s.id = p_id and s.buyer = u.id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ сделка: спор — не больше двух раз, отзыв спора не продлевает срок бесконечно ═════════════
create or replace function public.sauda_order_act(p_token text, p_id bigint, p_action text, p_text text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; o sauda.orders; txt text := trim(coalesce(p_text, ''));
begin
  u := sauda.me(p_token);
  select * into o from sauda.orders where id = p_id for update;
  if not found or u.id not in (o.buyer, o.seller) then raise exception 'not_found'; end if;
  if length(txt) > 3000 then raise exception 'too_long'; end if;

  if p_action = 'deliver' then
    if u.id <> o.seller then raise exception 'forbidden'; end if;
    if o.status <> 'paid' then raise exception 'bad_status'; end if;
    update sauda.orders set status = 'delivered', delivered_at = now(),
           payload = case when txt = '' then payload when payload = '' then txt else payload || chr(10) || txt end,
           complete_at = now() + make_interval(hours => sauda.cfgn('complete_hours')::int)
     where id = o.id;
    if txt <> '' then perform sauda.post(sauda.chat_of(o.buyer, o.seller), o.seller, 'text', txt, o.id); end if;
    perform sauda.sys(o.buyer, o.seller, o.seller, jsonb_build_object('k', 'order_delivered', 'id', o.id), o.id);
    perform sauda.notify(o.buyer, 'order_delivered', jsonb_build_object('id', o.id, 'title', o.title), '#/order/' || o.id);

  elsif p_action = 'confirm' then
    if u.id <> o.buyer then raise exception 'forbidden'; end if;
    if o.status not in ('paid', 'delivered') then raise exception 'bad_status'; end if;
    perform sauda.complete(o.id, 'buyer');

  elsif p_action = 'refund' then
    if u.id <> o.seller then raise exception 'forbidden'; end if;
    perform sauda.refund(o.id, 'seller');

  elsif p_action = 'cancel' then
    if u.id <> o.buyer then raise exception 'forbidden'; end if;
    if o.status <> 'paid' then raise exception 'bad_status'; end if;
    if o.deliver_by > now() then raise exception 'too_early'; end if;
    perform sauda.refund(o.id, 'buyer');

  elsif p_action = 'dispute' then
    if o.status not in ('paid', 'delivered') then raise exception 'bad_status'; end if;
    if length(txt) < 5 then raise exception 'need_reason'; end if;
    if o.disputes >= 2 then raise exception 'dispute_limit'; end if;
    update sauda.orders set status = 'dispute', dispute_reason = txt, dispute_by = u.id, complete_at = null, disputes = disputes + 1 where id = o.id;
    perform sauda.sys(o.buyer, o.seller, u.id, jsonb_build_object('k', 'dispute_open', 'id', o.id, 'reason', txt,
      'by', case when u.id = o.buyer then 'buyer' else 'seller' end), o.id);
    perform sauda.notify(case when u.id = o.buyer then o.seller else o.buyer end, 'dispute_open', jsonb_build_object('id', o.id, 'title', o.title), '#/order/' || o.id);
    perform sauda.notify_staff('dispute_new', jsonb_build_object('id', o.id, 'title', o.title, 'amount', o.amount), '#/admin/disputes');

  elsif p_action = 'undispute' then
    if o.status <> 'dispute' then raise exception 'bad_status'; end if;
    if o.dispute_by <> u.id then raise exception 'forbidden'; end if;
    -- срок подтверждения идёт от выполнения заказа, а не заново; минимум полсуток на проверку
    update sauda.orders set
      status = case when delivered_at is not null then 'delivered' else 'paid' end,
      complete_at = case when delivered_at is not null then greatest(now() + interval '12 hours',
        delivered_at + make_interval(hours => sauda.cfgn(case when auto then 'complete_hours_auto' else 'complete_hours' end)::int)) end,
      dispute_reason = ''
    where id = o.id;
    perform sauda.sys(o.buyer, o.seller, u.id, jsonb_build_object('k', 'dispute_closed', 'id', o.id), o.id);
  else
    raise exception 'bad_action';
  end if;

  select * into o from sauda.orders where id = p_id;
  return jsonb_build_object('ok', true, 'order', sauda.order_json(o, u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ кошелёк ═════════════
create or replace function public.sauda_wallet(p_token text, p_before bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'balance', u.balance, 'test_mode', sauda.test_mode(), 'pay', sauda.pay_info(),
    'hold_in', (select coalesce(sum(amount), 0) from sauda.orders where seller = u.id and status in ('paid', 'delivered', 'dispute')),
    'hold_out', (select coalesce(sum(amount), 0) from sauda.orders where buyer = u.id and status in ('paid', 'delivered', 'dispute')),
    'earned', (select coalesce(sum(amount), 0) from sauda.tx where user_id = u.id and kind in ('sale', 'referral')),
    'spent', (select coalesce(-sum(amount), 0) from sauda.tx where user_id = u.id and kind in ('purchase', 'pro')),
    'tx', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'kind', t.kind, 'ref', t.ref, 'note', t.note,
              'balance_after', t.balance_after, 'created_at', t.created_at) order by t.id desc), '[]'::jsonb)
           from (select * from sauda.tx where user_id = u.id and (p_before is null or id < p_before) order by id desc limit 50) t),
    'topups', (select coalesce(jsonb_agg(sauda.topup_json(x) order by x.id desc), '[]'::jsonb)
           from (select * from sauda.topups where user_id = u.id and not test and (status = 'pending' or created_at > now() - interval '7 days')
                 order by id desc limit 10) x),
    'withdrawals', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'amount', w.amount, 'fee', w.fee, 'method', w.method,
              'details', '•••• ' || right(w.details, 4), 'status', w.status, 'note', w.note, 'test', w.test,
              'created_at', w.created_at, 'processed_at', w.processed_at) order by w.id desc), '[]'::jsonb)
           from (select * from sauda.withdrawals where user_id = u.id order by id desc limit 20) w));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- пополнение: в тестовом режиме — сразу; в боевом — заявка с кодом, человек переводит деньги, администратор подтверждает
create or replace function public.sauda_topup(p_token text, p_amount bigint, p_method text default 'kaspi')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; tid bigint; today bigint; x sauda.topups;
begin
  u := sauda.me(p_token);
  if p_method not in ('kaspi', 'halyk', 'card', 'freedom', 'apple', 'google', 'link') then raise exception 'bad_input'; end if;
  if p_amount is null or p_amount < 100 or p_amount > sauda.cfgn('max_topup') then raise exception 'bad_amount'; end if;
  select coalesce(sum(amount), 0) into today from sauda.topups
   where user_id = u.id and status in ('pending', 'paid') and created_at > now() - interval '1 day';
  if today + p_amount > 2000000 then raise exception 'limit_day'; end if;
  if sauda.test_mode() then
    insert into sauda.topups(user_id, amount, method, status, paid_at, test) values (u.id, p_amount, p_method, 'paid', now(), true) returning id into tid;
    return jsonb_build_object('ok', true, 'balance', sauda.money(u.id, p_amount, 'topup', tid, p_method), 'test', true);
  end if;
  if sauda.cfgs('pay_kaspi_phone') = '' and sauda.cfgs('pay_card') = '' and sauda.cfgs('pay_link') = '' then raise exception 'payments_soon'; end if;
  if (select count(*) from sauda.topups where user_id = u.id and status = 'pending') >= 3 then raise exception 'too_many_topups'; end if;
  insert into sauda.topups(user_id, amount, method, status) values (u.id, p_amount, p_method, 'pending') returning id into tid;
  update sauda.topups set code = 'SD' || tid where id = tid returning * into x;
  return jsonb_build_object('ok', true, 'pending', true, 'topup', sauda.topup_json(x), 'pay', sauda.pay_info());
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- «Я оплатил» — заявка уходит администратору на проверку; «Отменить» — пока не оплачено
create or replace function public.sauda_topup_act(p_token text, p_id bigint, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; x sauda.topups;
begin
  u := sauda.me(p_token);
  select * into x from sauda.topups where id = p_id and user_id = u.id for update;
  if not found then raise exception 'not_found'; end if;
  if x.status <> 'pending' then raise exception 'bad_status'; end if;
  if p_action = 'claim' then
    if x.claimed_at is null then
      update sauda.topups set claimed_at = now() where id = x.id returning * into x;
      perform sauda.notify_staff('topup_new', jsonb_build_object('id', x.id, 'amount', x.amount, 'code', x.code, 'login', u.login), '#/admin/topups');
    end if;
  elsif p_action = 'cancel' then
    update sauda.topups set status = 'canceled', note = 'user' where id = x.id returning * into x;
  else
    raise exception 'bad_action';
  end if;
  return jsonb_build_object('ok', true, 'topup', sauda.topup_json(x));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- вывод: заявок «в очереди» не больше трёх
create or replace function public.sauda_withdraw(p_token text, p_amount bigint, p_method text, p_details text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; d text := regexp_replace(coalesce(p_details, ''), '[^0-9]', '', 'g'); v_fee bigint; wid bigint; b bigint;
begin
  u := sauda.me(p_token);
  if p_method not in ('kaspi', 'halyk', 'card', 'freedom') then raise exception 'bad_input'; end if;
  if p_method = 'card' then
    if length(d) not between 16 and 19 or not sauda.luhn(d) then raise exception 'bad_card'; end if;
  else
    if length(d) = 10 and left(d, 1) = '7' then d := '7' || d; end if;
    if length(d) = 11 and left(d, 1) = '8' then d := '7' || substr(d, 2); end if;
    if d !~ '^77[0-9]{9}$' then raise exception 'bad_phone'; end if;
  end if;
  if p_amount is null or p_amount < sauda.cfgn('min_withdraw') then raise exception 'bad_amount'; end if;
  if (select count(*) from sauda.withdrawals where user_id = u.id and status in ('pending', 'processing')) >= 3 then raise exception 'too_many_pending'; end if;
  v_fee := ceil(p_amount * sauda.cfgn('withdraw_fee_pct') / 100.0)::bigint;
  insert into sauda.withdrawals(user_id, amount, fee, method, details, test) values (u.id, p_amount, v_fee, p_method, d, sauda.test_mode()) returning id into wid;
  b := sauda.money(u.id, -p_amount, 'withdraw', wid, p_method);
  perform sauda.notify_staff('withdraw_new', jsonb_build_object('id', wid, 'amount', p_amount, 'login', u.login), '#/admin/withdrawals');
  return jsonb_build_object('ok', true, 'id', wid, 'balance', b, 'fee', v_fee);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- передумал выводить: деньги возвращаются, пока администратор не начал перевод
create or replace function public.sauda_withdraw_cancel(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; w sauda.withdrawals; b bigint;
begin
  u := sauda.me(p_token);
  select * into w from sauda.withdrawals where id = p_id and user_id = u.id for update;
  if not found then raise exception 'not_found'; end if;
  if w.status <> 'pending' then raise exception 'bad_status'; end if;
  update sauda.withdrawals set status = 'canceled', processed_at = now() where id = w.id;
  b := sauda.money(u.id, w.amount, 'withdraw_back', w.id, '');
  return jsonb_build_object('ok', true, 'balance', b);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- Sauda Pro: срок продлевается в одной записи — две покупки подряд не теряют месяцы
create or replace function public.sauda_pro(p_token text, p_months int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; price bigint; until timestamptz;
begin
  u := sauda.me(p_token);
  price := ((select v from sauda.config where k = 'pro_prices') ->> p_months::text)::bigint;
  if price is null then raise exception 'bad_input'; end if;
  perform sauda.money(u.id, -price, 'pro', null, p_months || ' мес.');
  perform sauda.money(sauda.platform(), price, 'pro_in', null, u.login);
  update sauda.users set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => 30 * p_months)
   where id = u.id returning pro_until into until;
  return jsonb_build_object('ok', true, 'pro_until', until);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ администрирование ═════════════
create or replace function public.sauda_admin(p_token text, p_action text, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u sauda.users; adm boolean; o sauda.orders; w sauda.withdrawals; x sauda.topups; t sauda.users; res jsonb; pf uuid := sauda.platform();
  q text := lower(trim(coalesce(p->>'q', ''))); amt bigint; peer uuid; r record; v_k text;
begin
  u := sauda.me(p_token);
  if u.role not in ('admin', 'moder') then raise exception 'forbidden'; end if;
  adm := u.role = 'admin';
  p := coalesce(p, '{}'::jsonb);

  if p_action = 'stats' then
    res := jsonb_build_object(
      'users', (select count(*) from sauda.users where role <> 'bot' and not is_demo),
      'users_today', (select count(*) from sauda.users where role <> 'bot' and not is_demo and created_at > now() - interval '1 day'),
      'online', (select count(*) from sauda.users where role <> 'bot' and not is_demo and last_seen > now() - interval '5 minutes'),
      'lots', (select count(*) from sauda.lots where status = 'active' and not is_demo),
      'orders', (select count(*) from sauda.orders),
      'orders_today', (select count(*) from sauda.orders where created_at > now() - interval '1 day'),
      'gmv', (select coalesce(sum(amount), 0) from sauda.orders where status = 'completed'),
      'gmv_30', (select coalesce(sum(amount), 0) from sauda.orders where status = 'completed' and closed_at > now() - interval '30 days'),
      'fees', (select coalesce(sum(amount), 0) from sauda.tx where user_id = pf and kind = 'fee'),
      'pro_income', (select coalesce(sum(amount), 0) from sauda.tx where user_id = pf and kind = 'pro_in'),
      'platform_balance', (select balance from sauda.users where id = pf),
      'user_balances', (select coalesce(sum(balance), 0) from sauda.users where role <> 'bot'),
      'escrow', (select coalesce(sum(amount), 0) from sauda.orders where status in ('paid', 'delivered', 'dispute')),
      'disputes', (select count(*) from sauda.orders where status = 'dispute'),
      'withdrawals', (select count(*) from sauda.withdrawals where status in ('pending', 'processing')),
      'withdrawals_sum', (select coalesce(sum(amount), 0) from sauda.withdrawals where status in ('pending', 'processing')),
      'topups', (select count(*) from sauda.topups where status = 'pending' and claimed_at is not null),
      'topups_in', (select coalesce(sum(amount), 0) from sauda.topups where status = 'paid' and not test),
      'reports', (select count(*) from sauda.reports where status = 'open'),
      'support', (select coalesce(sum(case when c.a = pf then c.unread_a else c.unread_b end), 0) from sauda.chats c where c.a = pf or c.b = pf),
      'pro_users', (select count(*) from sauda.users where pro_until > now()),
      'days', (select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'n', coalesce(y.n, 0), 'sum', coalesce(y.s, 0)) order by d), '[]'::jsonb)
        from generate_series((now() at time zone 'Asia/Almaty')::date - 13, (now() at time zone 'Asia/Almaty')::date, interval '1 day') d
        left join (select (created_at at time zone 'Asia/Almaty')::date dd, count(*) n, sum(amount) s from sauda.orders
                   where created_at > now() - interval '15 days' group by 1) y on y.dd = d::date),
      'test_mode', sauda.test_mode(),
      'live_since', (select v from sauda.config where k = 'live_since'));

  elsif p_action = 'orders' then
    res := (select coalesce(jsonb_agg(sauda.order_json(z, u.id) order by z.id desc), '[]'::jsonb) from (
      select o2.* from sauda.orders o2
      where (coalesce(p->>'status', '') = '' or o2.status = p->>'status')
        and (q = '' or o2.id::text = q or strpos(lower(o2.title), q) > 0
             or exists (select 1 from sauda.users zz where zz.id in (o2.buyer, o2.seller) and zz.login = q))
      order by o2.id desc limit 100) z);

  elsif p_action = 'disputes' then
    res := (select coalesce(jsonb_agg(sauda.order_json(z, u.id) order by z.id), '[]'::jsonb) from sauda.orders z where z.status = 'dispute');

  elsif p_action = 'chat_between' then
    res := sauda.chat_read((p->>'a')::uuid, (p->>'b')::uuid, 0, null, false);

  elsif p_action = 'resolve' then
    select * into o from sauda.orders where id = (p->>'id')::bigint;
    if not found then raise exception 'not_found'; end if;
    if u.id in (o.buyer, o.seller) then raise exception 'forbidden'; end if; -- свой спор не решают
    if o.status <> 'dispute' and not adm then raise exception 'forbidden'; end if; -- модератор решает только споры
    if p->>'winner' = 'buyer' then perform sauda.refund(o.id, 'admin:' || left(coalesce(p->>'note', ''), 200));
    elsif p->>'winner' = 'seller' then perform sauda.complete(o.id, 'admin:' || left(coalesce(p->>'note', ''), 200));
    else raise exception 'bad_input'; end if;
    perform sauda.sys(o.buyer, o.seller, null, jsonb_build_object('k', 'dispute_resolved', 'id', o.id, 'winner', p->>'winner',
      'note', left(coalesce(p->>'note', ''), 200)), o.id);
    res := jsonb_build_object('done', true);

  elsif p_action = 'withdrawals' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'amount', z.amount, 'fee', z.fee, 'method', z.method, 'details', z.details,
              'status', z.status, 'note', z.note, 'test', z.test, 'created_at', z.created_at, 'processed_at', z.processed_at,
              'user', sauda.mini(zu)) order by z.id desc), '[]'::jsonb)
            from (select * from sauda.withdrawals
                  where case coalesce(nullif(p->>'status', ''), 'pending')
                          when 'all' then true when 'pending' then status in ('pending', 'processing') else status = p->>'status' end
                  order by id desc limit 200) z join sauda.users zu on zu.id = z.user_id);

  elsif p_action = 'withdraw_set' then
    if not adm then raise exception 'forbidden'; end if;
    select * into w from sauda.withdrawals where id = (p->>'id')::bigint for update;
    if not found or w.status not in ('pending', 'processing') then raise exception 'bad_status'; end if;
    if p->>'status' = 'processing' then
      -- взята в работу: человек уже не отменит, пока идёт перевод
      update sauda.withdrawals set status = 'processing' where id = w.id;
    elsif p->>'status' = 'done' then
      update sauda.withdrawals set status = 'done', processed_at = now(), note = left(coalesce(p->>'note', ''), 200) where id = w.id;
      if w.fee > 0 then perform sauda.money(pf, w.fee, 'withdraw_fee', w.id, ''); end if;
      perform sauda.notify(w.user_id, 'withdraw_done', jsonb_build_object('id', w.id, 'amount', w.amount - w.fee), '#/wallet');
    elsif p->>'status' = 'rejected' then
      update sauda.withdrawals set status = 'rejected', processed_at = now(), note = left(coalesce(p->>'note', ''), 200) where id = w.id;
      perform sauda.money(w.user_id, w.amount, 'withdraw_back', w.id, coalesce(p->>'note', ''));
      perform sauda.notify(w.user_id, 'withdraw_rejected', jsonb_build_object('id', w.id, 'amount', w.amount, 'note', coalesce(p->>'note', '')), '#/wallet');
    else raise exception 'bad_input'; end if;
    res := jsonb_build_object('done', true);

  elsif p_action = 'topups' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select coalesce(jsonb_agg(sauda.topup_json(z) || jsonb_build_object('user', sauda.mini(zu)) order by z.claimed_at nulls last, z.id desc), '[]'::jsonb)
            from (select * from sauda.topups
                  where not test and (case coalesce(nullif(p->>'status', ''), 'pending') when 'all' then true else status = coalesce(nullif(p->>'status', ''), 'pending') end)
                    and (q = '' or lower(code) = q or id::text = q)
                  order by id desc limit 200) z join sauda.users zu on zu.id = z.user_id);

  elsif p_action = 'topup_set' then
    -- деньги пришли на счёт — зачислить (можно поправить сумму, если перевели другую); не пришли — отклонить
    if not adm then raise exception 'forbidden'; end if;
    select * into x from sauda.topups where id = (p->>'id')::bigint for update;
    if not found or x.status <> 'pending' or x.test then raise exception 'bad_status'; end if;
    if p->>'status' = 'paid' then
      amt := coalesce((p->>'amount')::bigint, x.amount);
      if amt < 1 or amt > 10000000 then raise exception 'bad_amount'; end if;
      update sauda.topups set status = 'paid', amount = amt, paid_at = now(), provider_ref = left(coalesce(p->>'note', ''), 200),
             note = 'by:' || u.login where id = x.id;
      perform sauda.money(x.user_id, amt, 'topup', x.id, x.method);
      perform sauda.notify(x.user_id, 'topup_done', jsonb_build_object('id', x.id, 'amount', amt), '#/wallet');
    elsif p->>'status' = 'failed' then
      update sauda.topups set status = 'failed', note = left(coalesce(p->>'note', ''), 200) where id = x.id;
      perform sauda.notify(x.user_id, 'topup_failed', jsonb_build_object('id', x.id, 'amount', x.amount, 'note', coalesce(p->>'note', '')), '#/wallet');
    else raise exception 'bad_input'; end if;
    res := jsonb_build_object('done', true);

  elsif p_action = 'users' then
    res := (select coalesce(jsonb_agg(sauda.mini(z) || jsonb_build_object('balance', z.balance, 'role', z.role, 'ban_reason', z.ban_reason,
              'purchases', z.purchases, 'pro_until', z.pro_until) order by z.created_at desc), '[]'::jsonb)
            from (select * from sauda.users where (q = '' or strpos(login, q) > 0 or strpos(lower(name), q) > 0)
                  and role <> 'bot' order by created_at desc limit 100) z);

  elsif p_action = 'user_set' then
    select * into t from sauda.users where id = (p->>'id')::uuid for update;
    if not found or t.role = 'bot' then raise exception 'not_found'; end if;
    if t.role = 'admin' and not adm then raise exception 'forbidden'; end if;
    if t.id = u.id and p ? 'banned' then raise exception 'forbidden'; end if;
    if p ? 'banned' then
      update sauda.users set banned = (p->>'banned')::boolean, ban_reason = left(coalesce(p->>'ban_reason', ''), 200) where id = t.id;
      if (p->>'banned')::boolean then
        delete from sauda.sessions where user_id = t.id;
        update sauda.lots set status = 'paused' where seller = t.id and status = 'active';
        update sauda.subs set active = false where active and (buyer = t.id or lot_id in (select id from sauda.lots where seller = t.id));
        -- деньги за незакрытые заказы у заблокированного продавца возвращаются покупателям
        for r in select id from sauda.orders where seller = t.id and status in ('paid', 'delivered', 'dispute') order by id loop
          perform sauda.refund(r.id, 'admin:ban');
        end loop;
      end if;
    end if;
    if p ? 'verified' then update sauda.users set verified = (p->>'verified')::boolean where id = t.id; end if;
    if p ? 'role' then
      if not adm or p->>'role' not in ('user', 'moder', 'admin') or t.id = u.id then raise exception 'forbidden'; end if;
      update sauda.users set role = p->>'role' where id = t.id;
    end if;
    if p ? 'pro_days' then
      if not adm then raise exception 'forbidden'; end if;
      update sauda.users set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => (p->>'pro_days')::int) where id = t.id;
    end if;
    res := jsonb_build_object('done', true);

  elsif p_action = 'balance' then
    if not adm then raise exception 'forbidden'; end if;
    amt := (p->>'amount')::bigint;
    if amt is null or amt = 0 or abs(amt) > 10000000 then raise exception 'bad_amount'; end if;
    perform sauda.money((p->>'id')::uuid, amt, 'admin', null, left(coalesce(p->>'note', ''), 200));
    perform sauda.money(pf, -amt, 'admin_out', null, left(coalesce(p->>'note', ''), 200));
    perform sauda.notify((p->>'id')::uuid, 'balance_admin', jsonb_build_object('amount', amt, 'note', coalesce(p->>'note', '')), '#/wallet');
    res := jsonb_build_object('done', true);

  elsif p_action = 'lots' then
    res := (select coalesce(jsonb_agg(sauda.card(l, z) order by l.created_at desc), '[]'::jsonb) from (
        select * from sauda.lots y where (coalesce(p->>'status', '') = '' or y.status = p->>'status')
          and (q = '' or y.id::text = q or strpos(lower(y.title), q) > 0) and not y.is_demo
        order by y.created_at desc limit 100) l join sauda.users z on z.id = l.seller);

  elsif p_action = 'lot_block' then
    if (p->>'blocked')::boolean then
      update sauda.lots set status = 'blocked', updated_at = now() where id = (p->>'id')::bigint returning seller into peer;
      if peer is null then raise exception 'not_found'; end if;
      update sauda.subs set active = false where lot_id = (p->>'id')::bigint;
      perform sauda.notify(peer, 'lot_blocked', jsonb_build_object('id', p->>'id', 'reason', coalesce(p->>'reason', '')), '#/my-lots');
    else
      update sauda.lots set status = 'paused', updated_at = now() where id = (p->>'id')::bigint and status = 'blocked' returning seller into peer;
      if peer is null then raise exception 'not_found'; end if;
      perform sauda.notify(peer, 'lot_unblocked', jsonb_build_object('id', p->>'id'), '#/my-lots');
    end if;
    res := jsonb_build_object('done', true);

  elsif p_action = 'reports' then
    res := (select coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'kind', rp.kind, 'target', rp.target, 'text', rp.text, 'status', rp.status,
              'created_at', rp.created_at, 'user', sauda.mini(z)) order by rp.id desc), '[]'::jsonb)
            from (select * from sauda.reports where status = coalesce(nullif(p->>'status', ''), 'open') order by id desc limit 100) rp
            join sauda.users z on z.id = rp.user_id);

  elsif p_action = 'report_close' then
    update sauda.reports set status = 'closed' where id = (p->>'id')::bigint;
    res := jsonb_build_object('done', true);

  elsif p_action = 'promos' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'amount', amount, 'uses_left', uses_left, 'expires_at', expires_at,
              'used', (select count(*) from sauda.promo_uses pu where pu.code = pr.code), 'created_at', created_at) order by created_at desc), '[]'::jsonb)
            from sauda.promos pr);

  elsif p_action = 'promo_create' then
    if not adm then raise exception 'forbidden'; end if;
    if coalesce(p->>'code', '') !~ '^[A-Za-z0-9_-]{3,24}$' then raise exception 'bad_input'; end if;
    if coalesce((p->>'amount')::bigint, 0) < 1 or (p->>'amount')::bigint > 1000000 then raise exception 'bad_amount'; end if;
    insert into sauda.promos(code, amount, uses_left, expires_at)
    values (upper(p->>'code'), (p->>'amount')::bigint, greatest(coalesce((p->>'uses')::int, 1), 1),
            case when coalesce((p->>'days')::int, 0) > 0 then now() + make_interval(days => (p->>'days')::int) end);
    res := jsonb_build_object('done', true);

  elsif p_action = 'config' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select jsonb_object_agg(c.k, c.v) from sauda.config c where c.k <> 'admin_code');

  elsif p_action = 'config_set' then
    if not adm then raise exception 'forbidden'; end if;
    v_k := p->>'k';
    if v_k = 'test_mode' then
      if jsonb_typeof(p->'v') <> 'boolean' then raise exception 'bad_input'; end if;
      if (p->>'v')::boolean <> sauda.test_mode() then
        -- вернуться к тестовым деньгам после запуска нельзя: они смешались бы с настоящими
        if (p->>'v')::boolean then raise exception 'live_locked'; end if;
        if sauda.cfgs('pay_kaspi_phone') = '' and sauda.cfgs('pay_card') = '' and sauda.cfgs('pay_link') = '' then raise exception 'pay_not_set'; end if;
        perform sauda.go_live();
      end if;
    elsif v_k in ('pay_kaspi_phone', 'pay_kaspi_name', 'pay_card', 'pay_link', 'pay_note') then
      if jsonb_typeof(p->'v') <> 'string' or length(p->>'v') > 300 then raise exception 'bad_input'; end if;
      if v_k = 'pay_link' and p->>'v' <> '' and left(p->>'v', 8) <> 'https://' then raise exception 'bad_input'; end if;
      update sauda.config set v = to_jsonb(trim(p->>'v')) where k = v_k;
    elsif v_k = 'pro_prices' then
      if jsonb_typeof(p->'v') <> 'object' then raise exception 'bad_input'; end if;
      update sauda.config set v = p->'v' where k = 'pro_prices';
    elsif v_k in ('fee_pct', 'pro_fee_pct', 'complete_hours', 'complete_hours_auto', 'min_withdraw', 'withdraw_fee_pct', 'max_topup',
                'raise_min', 'raise_min_pro', 'ref_pct', 'max_lots', 'max_lots_pro') then
      if jsonb_typeof(p->'v') <> 'number' or (p->>'v')::numeric < 0 then raise exception 'bad_input'; end if;
      if v_k in ('fee_pct', 'pro_fee_pct', 'withdraw_fee_pct', 'ref_pct') and (p->>'v')::numeric > 100 then raise exception 'bad_input'; end if;
      if v_k in ('complete_hours', 'complete_hours_auto') and (p->>'v')::numeric < 1 then raise exception 'bad_input'; end if;
      update sauda.config set v = p->'v' where k = v_k;
    else
      raise exception 'bad_input';
    end if;
    res := jsonb_build_object('done', true, 'test_mode', sauda.test_mode());

  elsif p_action = 'support' then
    res := (select coalesce(jsonb_agg(jsonb_build_object('peer', sauda.mini(z), 'last_at', c.last_at, 'last_text', c.last_text,
              'last_kind', c.last_kind, 'last_mine', c.last_sender = pf,
              'unread', case when c.a = pf then c.unread_a else c.unread_b end) order by c.last_at desc), '[]'::jsonb)
            from (select * from sauda.chats where (a = pf or b = pf) and last_kind <> 'system' order by last_at desc limit 200) c
            join sauda.users z on z.id = case when c.a = pf then c.b else c.a end);

  elsif p_action = 'support_chat' then
    res := sauda.chat_read(pf, (p->>'user')::uuid, coalesce((p->>'after')::bigint, 0), null);

  elsif p_action = 'support_send' then
    res := sauda.chat_send(pf, (p->>'user')::uuid, p->>'body', coalesce(p->>'kind', 'text'));
    perform sauda.notify((p->>'user')::uuid, 'support_reply', '{}'::jsonb, '#/chat/' || pf);

  else
    raise exception 'bad_action';
  end if;
  return jsonb_build_object('ok', true, 'data', res);
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when data_exception or integrity_constraint_violation then return sauda.fail('bad_input');
end $$;

-- права: наружу — только public.sauda_*, внутренние функции схемы sauda закрыты
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and left(p.proname, 6) = 'sauda_' loop
    execute 'revoke all on function ' || f.sig::text || ' from public';
    execute 'grant execute on function ' || f.sig::text || ' to anon, authenticated';
  end loop;
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'sauda' loop
    execute 'revoke all on function ' || f.sig::text || ' from public, anon, authenticated';
  end loop;
end $$;
