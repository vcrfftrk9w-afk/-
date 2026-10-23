-- «Sauda»: удобство — умный поиск, восстановление пароля, защита редактора игр, «товар закончился».
--  • Поиск: каждое слово запроса ищется в названии, описании, игре, разделе и других названиях игры (games.aliases);
--    словоформы («алмазы» = «алмазов») — по началу слова; «пабг», «стандофф», «фри фаер» находят свои игры.
--  • Восстановление пароля: при регистрации выдаётся код восстановления; по логину и коду можно задать новый пароль;
--    новый код — в настройках (по паролю); администратор может выдать временный пароль.
--  • Редактор игр: «новая игра» не перезаписывает существующую (game_exists), пустые разделы не сохраняются,
--    у игры есть другие названия для поиска.
--  • Продавцу приходит уведомление, когда лот распродан. Код администратора меняется после использования.
--  • Настройки: срок автоподтверждения для вещей и контакт поддержки для тех, кто не может войти.

alter table sauda.games add column if not exists aliases text not null default '';
alter table sauda.users add column if not exists recovery_hash text not null default '';
insert into sauda.config(k, v) values ('support_contact', '""') on conflict (k) do nothing;

-- другие названия игр, как их пишут люди
update sauda.games g set aliases = a.al from (values
  ('standoff2', 'стандофф стендофф стандоф so2 голда'), ('pubgm', 'пабг пубг пабг мобайл pubg uc юси'),
  ('freefire', 'фри фаер фрифаер фри фаир ff алмазы'), ('mlbb', 'млбб мобайл легендс мобла ml алмазы'),
  ('brawlstars', 'бравл старс бравлстарс бс гемы'), ('roblox', 'роблокс робуксы robux'), ('genshin', 'геншин импакт'),
  ('clashroyale', 'клеш рояль клэш рояль'), ('coc', 'клеш оф кленс клэш кланс'), ('codm', 'кал оф дьюти колда cod'),
  ('hsr', 'хонкай стар рейл'), ('blackrussia', 'блэк раша блек раша br'), ('arenabreakout', 'арена брейкаут'),
  ('stumble', 'стамбл гайс'), ('tanksblitz', 'танки блиц wot blitz'), ('hayday', 'хей дей'), ('minecraft', 'майнкрафт майн'),
  ('cs2', 'кс кс2 ксго csgo cs контра'), ('dota2', 'дота дота2'), ('steam', 'стим'), ('gta5rp', 'гта гта5 рп gta'),
  ('valorant', 'валорант'), ('fortnite', 'фортнайт вбаксы v-bucks'), ('eafc', 'фифа fifa фк'), ('rust', 'раст'),
  ('tarkov', 'тарков eft'), ('lol', 'лол лига легенд'), ('apex', 'апекс'), ('wot', 'мир танков танки wot'),
  ('wow', 'вов варкрафт'), ('warface', 'варфейс'), ('psn', 'плейстейшн пс плейстейшен ps'), ('xbox', 'иксбокс'),
  ('telegram', 'телеграм телеграмм тг премиум звезды stars'), ('spotify', 'спотифай'), ('youtube', 'ютуб ютубе'),
  ('ai', 'чатгпт chatgpt gpt нейросеть midjourney'), ('netflix', 'нетфликс'), ('discord', 'дискорд нитро nitro'),
  ('yandex', 'яндекс плюс'), ('kinopoisk', 'кинопоиск'), ('apple', 'эпл айклауд icloud apple music'), ('vpn', 'впн'),
  ('duolingo', 'дуолинго'), ('tiktok', 'тикток тик ток'), ('instagram', 'инстаграм инста'), ('twitch', 'твич'),
  ('giftcards', 'гифт карта подарочная'), ('youtubech', 'ютуб канал')
) a(id, al) where g.id = a.id and g.aliases = '';

-- код восстановления: 12 знаков, в базе — только хеш
create or replace function sauda.recovery_norm(p text) returns text
language sql immutable set search_path = '' as $$ select upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')) $$;

create or replace function sauda.new_recovery(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text := upper(encode(extensions.gen_random_bytes(6), 'hex'));
begin
  update sauda.users set recovery_hash = encode(extensions.digest(c, 'sha256'), 'hex') where id = p_user;
  return left(c, 4) || '-' || substr(c, 5, 4) || '-' || right(c, 4);
end $$;

create or replace function sauda.secs(p text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare part text; a text[]; res jsonb := '[]'::jsonb; ru text; kz text;
  std constant jsonb := '{
    "accounts": ["Аккаунты", "Аккаунттар"],
    "currency": ["Валюта", "Валюта"],
    "donate":   ["Донат по ID", "ID арқылы донат"],
    "items":    ["Предметы и скины", "Заттар мен скиндер"],
    "boost":    ["Буст и прокачка", "Буст және деңгей көтеру"],
    "keys":     ["Ключи и гифты", "Кілттер мен гифттер"],
    "topup":    ["Пополнение кошелька", "Әмиянды толықтыру"],
    "subs":     ["Подписки", "Жазылымдар"],
    "services": ["Услуги", "Қызметтер"],
    "coaching": ["Обучение", "Оқыту"],
    "goods":    ["Товары", "Тауарлар"],
    "other":    ["Прочее", "Басқасы"]}';
begin
  foreach part in array string_to_array(p, '|') loop
    a := string_to_array(part, ':');
    if coalesce(trim(a[1]), '') = '' then continue; end if;
    ru := coalesce(nullif(a[2], ''), std -> a[1] ->> 0, a[1]);
    kz := coalesce(nullif(a[3], ''), case when a[2] is null then std -> a[1] ->> 1 end, ru);
    res := res || jsonb_build_array(jsonb_build_object('id', a[1], 'ru', ru, 'kz', kz));
  end loop;
  return res;
end $$;

create or replace function public.sauda_lots(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g text := nullif(p->>'game', ''); s text := nullif(p->>'section', ''); k text := nullif(p->>'kind', '');
  q text := nullif(lower(trim(coalesce(p->>'q', ''))), '');
  mn bigint := nullif(p->>'min', '')::bigint; mx bigint := nullif(p->>'max', '')::bigint;
  au boolean := coalesce((p->>'auto')::boolean, false); onl boolean := coalesce((p->>'online')::boolean, false);
  sel text := nullif(p->>'seller', ''); ct text := nullif(p->>'city', '');
  srt text := coalesce(nullif(p->>'sort', ''), 'top');
  lim int := least(greatest(coalesce((p->>'limit')::int, 30), 1), 60);
  off int := greatest(coalesce((p->>'offset')::int, 0), 0);
  tm boolean := sauda.test_mode(); res jsonb; total bigint;
  -- слова запроса; длинные слова — по началу (словоформы: «алмазы» найдёт «алмазов»)
  ws text[] := array(select case when length(w) <= 3 then w when length(w) = 4 then left(w, 3) else left(w, greatest(4, length(w) - 2)) end
                     from regexp_split_to_table(translate(coalesce(q, ''), 'ё', 'е'), '[^[:alnum:]]+') w where w <> '');
begin
  select coalesce(jsonb_agg(sauda.card(l, u) order by x.rn), '[]'::jsonb), coalesce(max(x.total), 0) into res, total
  from (
    select l.id, count(*) over () total, row_number() over (order by
        case when srt = 'cheap' then l.price end asc,
        case when srt = 'expensive' then l.price end desc,
        case when srt = 'rating' then sauda.rating(u) end desc,
        case when srt = 'rating' then u.reviews end desc,
        case when srt = 'new' then l.created_at end desc,
        case when srt = 'popular' then l.sold end desc,
        case when srt = 'top' then u.last_seen > now() - interval '5 minutes' end desc,
        case when srt = 'top' then coalesce(u.pro_until > now(), false) end desc,
        l.raised_at desc, l.id desc) rn
    from sauda.lots l
    join sauda.users u on u.id = l.seller
    join sauda.games gg on gg.id = l.game
    where l.status = 'active' and not u.banned and (tm or not l.is_demo)
      and (g is null or l.game = g) and (s is null or l.section = s) and (k is null or gg.kind = k)
      and (q is null or cardinality(ws) > 0 and not exists (select 1 from unnest(ws) w where strpos(translate(lower(
            l.title || ' ' || l.descr || ' ' || gg.name || ' ' || gg.aliases || ' ' ||
            coalesce((select x->>'ru' from jsonb_array_elements(gg.sections) x where x->>'id' = l.section), '')), 'ё', 'е'), w) = 0))
      and (mn is null or l.price >= mn) and (mx is null or l.price <= mx)
      and (not au or l.auto) and (not onl or u.last_seen > now() - interval '5 minutes')
      and (sel is null or u.login = sel) and (ct is null or l.city = ct)
    order by rn limit lim offset off
  ) x
  join sauda.lots l on l.id = x.id join sauda.users u on u.id = l.seller;
  return jsonb_build_object('ok', true, 'items', res, 'total', total);
exception when data_exception then return sauda.fail('bad_input');
end $$;

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
  return jsonb_build_object('ok', true, 'token', sauda.new_session(u, p_device), 'login', l, 'recovery', sauda.new_recovery(u));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- новый код восстановления (старый перестаёт действовать); нужен текущий пароль
create or replace function public.sauda_recovery_new(p_token text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if u.pass_hash <> extensions.crypt(coalesce(p_password, ''), u.pass_hash) then raise exception 'bad_password_old'; end if;
  return jsonb_build_object('ok', true, 'recovery', sauda.new_recovery(u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- забыл пароль: логин + код восстановления → новый пароль, все старые входы закрываются, выдаётся новый код.
-- Попытки считаются вместе с попытками входа (10 неверных с одного адреса — пауза 15 минут).
create or replace function public.sauda_recover(p_login text, p_code text, p_new text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); u sauda.users; v_ip text := sauda.client_ip(); f sauda.login_fails;
begin
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return sauda.fail('bad_password'); end if;
  insert into sauda.login_fails as x (login, ip, n) values (l, v_ip, 1)
  on conflict (login, ip) do update set
    n = case when x.until is not null and x.until <= now() then 1 else x.n + 1 end,
    until = case when x.until is not null and x.until <= now() then null else x.until end,
    updated_at = now()
  returning * into f;
  if (f.until is not null and f.until > now()) or f.n > 10 then
    update sauda.login_fails set until = greatest(until, now() + interval '15 minutes') where login = l and ip = v_ip returning * into f;
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', f.until);
  end if;
  select * into u from sauda.users where login = l and role <> 'bot' and not is_demo;
  if not found or u.recovery_hash = '' or u.recovery_hash <> encode(extensions.digest(sauda.recovery_norm(p_code), 'sha256'), 'hex') then
    if f.n >= 10 then update sauda.login_fails set until = now() + interval '15 minutes' where login = l and ip = v_ip; end if;
    return sauda.fail('bad_recovery');
  end if;
  if u.banned then return sauda.fail('banned'); end if;
  delete from sauda.login_fails where login = l and ip = v_ip;
  update sauda.users set pass_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), fails = 0, locked_until = null where id = u.id;
  delete from sauda.sessions where user_id = u.id;
  return jsonb_build_object('ok', true, 'token', sauda.new_session(u.id, p_device), 'login', u.login, 'recovery', sauda.new_recovery(u.id));
end $$;

-- администратор выдаёт временный пароль (после проверки, что пишет хозяин аккаунта); все входы закрываются
create or replace function public.sauda_admin_pass(p_token text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; t sauda.users; pw text := lower(encode(extensions.gen_random_bytes(5), 'hex'));
begin
  u := sauda.me(p_token);
  if u.role <> 'admin' then raise exception 'forbidden'; end if;
  select * into t from sauda.users where id = p_user for update;
  if not found or t.role = 'bot' or t.is_demo then raise exception 'not_found'; end if;
  if t.id = u.id then raise exception 'forbidden'; end if;
  update sauda.users set pass_hash = extensions.crypt(pw, extensions.gen_salt('bf', 10)) where id = t.id;
  delete from sauda.sessions where user_id = t.id;
  return jsonb_build_object('ok', true, 'password', pw, 'login', t.login);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  perform sauda.maybe_tick();
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true,
    'user', sauda.mini(u) || jsonb_build_object('balance', u.balance, 'bio', u.bio, 'city', u.city, 'lang', u.lang,
              'role', u.role, 'pro_until', u.pro_until, 'ref_code', u.ref_code, 'purchases', u.purchases,
              'xp', u.xp, 'fee_pct', sauda.fee_pct(u), 'cashback_pct', sauda.perk(u.xp, 'cashback'),
              'has_recovery', u.recovery_hash <> ''),
    'unread', (select coalesce(sum(case when c.a = u.id then c.unread_a else c.unread_b end), 0) from sauda.chats c where c.a = u.id or c.b = u.id),
    'notifs', (select count(*) from sauda.notifs where user_id = u.id and not read),
    'active_buy', (select count(*) from sauda.orders where buyer = u.id and status in ('paid', 'delivered', 'dispute')),
    'active_sell', (select count(*) from sauda.orders where seller = u.id and status in ('paid', 'dispute')),
    'test_mode', sauda.test_mode());
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_admin_claim(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if coalesce(trim(p_code), '') = '' or trim(p_code) <> (select v #>> '{}' from sauda.config where k = 'admin_code') then
    raise exception 'bad_code';
  end if;
  update sauda.users set role = 'admin' where id = u.id;
  update sauda.config set v = to_jsonb(encode(extensions.gen_random_bytes(9), 'hex')) where k = 'admin_code';
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function sauda.order_json(o sauda.orders, me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'lot_id', o.lot_id, 'game', o.game, 'section', o.section, 'title', o.title,
    'unit_price', o.unit_price, 'qty', o.qty, 'amount', o.amount, 'fee', o.fee, 'status', o.status,
    'buyer_data', o.buyer_data, 'payload', o.payload, 'auto', o.auto, 'sub_id', o.sub_id,
    'dispute_reason', o.dispute_reason, 'dispute_by', o.dispute_by, 'resolution', o.resolution, 'reviewed', o.reviewed,
    'created_at', o.created_at, 'deliver_by', o.deliver_by, 'delivered_at', o.delivered_at,
    'complete_at', o.complete_at, 'closed_at', o.closed_at,
    'role', case when me = o.buyer then 'buyer' when me = o.seller then 'seller' else 'staff' end,
    'buyer', (select sauda.mini(u) from sauda.users u where u.id = o.buyer),
    'seller', (select sauda.mini(u) from sauda.users u where u.id = o.seller),
    'thumb', (select l.thumb from sauda.lots l where l.id = o.lot_id),
    'period_days', (select l.period_days from sauda.lots l where l.id = o.lot_id),
    'id_label', (select l.id_label from sauda.lots l where l.id = o.lot_id),
    'goods', exists (select 1 from sauda.games g where g.id = o.game and g.kind = 'goods'))
$$;

create or replace function sauda.place_order(p_buyer uuid, p_lot bigint, p_qty int, p_data text, p_sub bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare l sauda.lots; s sauda.users; b sauda.users; amt bigint; oid bigint; n int; items text;
begin
  perform pg_advisory_xact_lock_shared(4711002);
  select * into l from sauda.lots where id = p_lot for update;
  if not found or l.status <> 'active' then raise exception 'lot_unavailable'; end if;
  if l.is_demo and not sauda.test_mode() then raise exception 'lot_unavailable'; end if;
  if l.seller = p_buyer then raise exception 'own_lot'; end if;
  select * into s from sauda.users where id = l.seller;
  if s.banned then raise exception 'lot_unavailable'; end if;
  select * into b from sauda.users where id = p_buyer;
  if b.banned then raise exception 'banned'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then raise exception 'bad_qty'; end if;
  if l.qty is not null and l.qty < p_qty then raise exception 'not_enough_stock'; end if;
  if l.needs_id and length(trim(coalesce(p_data, ''))) < 2 then raise exception 'need_buyer_data'; end if;
  if length(coalesce(p_data, '')) > 500 then raise exception 'bad_input'; end if;
  amt := l.price * p_qty;

  insert into sauda.orders(lot_id, buyer, seller, game, section, title, unit_price, qty, amount, status, buyer_data, auto, sub_id, deliver_by)
  values (l.id, p_buyer, l.seller, l.game, l.section, l.title, l.price, p_qty, amt, 'paid', trim(coalesce(p_data, '')), l.auto, p_sub,
          now() + make_interval(mins => l.deliver_mins))
  returning id into oid;
  perform sauda.money(p_buyer, -amt, 'purchase', oid, l.title);

  if l.auto then
    update sauda.lot_items set order_id = oid
     where id in (select id from sauda.lot_items where lot_id = l.id and order_id is null order by id limit p_qty for update skip locked);
    get diagnostics n = row_count;
    if n < p_qty then raise exception 'not_enough_stock'; end if;
    select string_agg(payload, chr(10) order by id) into items from sauda.lot_items where order_id = oid;
    update sauda.orders set payload = items, status = 'delivered', delivered_at = now(),
           complete_at = now() + make_interval(hours => sauda.cfgn('complete_hours_auto')::int)
     where id = oid;
  end if;

  update sauda.lots set
    qty = case when qty is null then null else qty - p_qty end,
    sold = sold + p_qty,
    status = case when qty is not null and qty - p_qty <= 0 then 'sold' else status end
  where id = l.id;

  perform sauda.sys(p_buyer, l.seller, p_buyer,
    jsonb_build_object('k', 'order_paid', 'id', oid, 'title', l.title, 'qty', p_qty, 'amount', amt, 'auto', l.auto,
                       'data', trim(coalesce(p_data, '')), 'renew', p_sub is not null), oid);
  if l.qty is not null and l.qty - p_qty <= 0 and not l.is_demo then
    perform sauda.notify(l.seller, 'lot_soldout', jsonb_build_object('id', l.id, 'title', l.title), '#/sell/' || l.id);
  end if;
  perform sauda.notify(l.seller, 'order_new', jsonb_build_object('id', oid, 'title', l.title, 'amount', amt, 'auto', l.auto), '#/order/' || oid);
  return oid;
end $$;

create or replace function public.sauda_admin_game(p_token text, p_action text, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; g sauda.games; v_id text := lower(trim(coalesce(p->>'id', ''))); v_secs jsonb; s jsonb;
begin
  u := sauda.me(p_token);
  if u.role <> 'admin' then raise exception 'forbidden'; end if;
  p := coalesce(p, '{}'::jsonb);

  if p_action = 'list' then
    return jsonb_build_object('ok', true, 'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'kind', x.kind, 'emoji', x.emoji, 'color', x.color, 'sort', x.sort, 'popular', x.popular,
        'sections', x.sections, 'logo', x.logo, 'aliases', x.aliases,
        'lots', (select count(*) from sauda.lots l where l.game = x.id and l.status <> 'deleted')) order by x.kind, x.sort, x.name), '[]'::jsonb)
      from sauda.games x));

  elsif p_action = 'save' then
    if v_id !~ '^[a-z0-9_]{2,24}$' then raise exception 'bad_game_id'; end if;
    if p ? 'name' and length(trim(p->>'name')) not between 1 and 40 then raise exception 'bad_title'; end if;
    if p ? 'kind' and p->>'kind' not in ('mobile', 'pc', 'subs', 'social', 'service', 'goods') then raise exception 'bad_input'; end if;
    if p ? 'emoji' and length(p->>'emoji') not between 1 and 8 then raise exception 'bad_input'; end if;
    if p ? 'color' and p->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_input'; end if;
    if p ? 'aliases' and length(p->>'aliases') > 300 then raise exception 'too_long'; end if;
    if p ? 'logo' and p->>'logo' <> '' and (p->>'logo' !~ '^data:image/(png|jpeg|webp);base64,' or length(p->>'logo') > 40000) then raise exception 'bad_image'; end if;
    if p ? 'sections' then
      v_secs := sauda.secs(trim(p->>'sections'));
      if jsonb_array_length(v_secs) = 0 then raise exception 'bad_section'; end if;
      for s in select * from jsonb_array_elements(v_secs) loop
        if coalesce(s->>'id', '') not in ('accounts', 'currency', 'donate', 'items', 'boost', 'keys', 'topup', 'subs', 'services', 'coaching', 'goods', 'other')
           or length(s->>'ru') > 40 or length(s->>'kz') > 40 then raise exception 'bad_section'; end if;
      end loop;
    end if;
    select * into g from sauda.games where id = v_id for update;
    -- «новая игра» с занятым кодом не перезаписывает существующую
    if found and coalesce((p->>'create')::boolean, false) then raise exception 'game_exists'; end if;
    if not found then
      if not (p ? 'name' and p ? 'kind' and p ? 'sections') then raise exception 'bad_input'; end if;
      insert into sauda.games(id, name, kind, emoji, color, sort, popular, sections, logo, aliases)
      values (v_id, trim(p->>'name'), p->>'kind', coalesce(nullif(p->>'emoji', ''), '🎮'), coalesce(p->>'color', '#00afca'),
              coalesce((p->>'sort')::int, 500), coalesce((p->>'popular')::boolean, false), v_secs, coalesce(p->>'logo', ''),
              lower(trim(coalesce(p->>'aliases', ''))));
    else
      -- раздел, в котором есть лоты, убрать нельзя — иначе лоты потеряются
      if v_secs is not null and exists (select 1 from sauda.lots l where l.game = v_id and l.status <> 'deleted'
          and not exists (select 1 from jsonb_array_elements(v_secs) e where e->>'id' = l.section)) then
        raise exception 'section_in_use';
      end if;
      update sauda.games set
        name = coalesce(nullif(trim(p->>'name'), ''), name),
        kind = coalesce(p->>'kind', kind),
        emoji = coalesce(nullif(p->>'emoji', ''), emoji),
        color = coalesce(p->>'color', color),
        sort = coalesce((p->>'sort')::int, sort),
        popular = coalesce((p->>'popular')::boolean, popular),
        sections = coalesce(v_secs, sections),
        logo = coalesce(p->>'logo', logo),
        aliases = coalesce(lower(trim(p->>'aliases')), aliases)
      where id = v_id;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id);

  elsif p_action = 'delete' then
    if exists (select 1 from sauda.lots where game = v_id and status <> 'deleted') then raise exception 'game_in_use'; end if;
    if exists (select 1 from sauda.lots where game = v_id) or exists (select 1 from sauda.orders where game = v_id) then
      raise exception 'game_in_use';
    end if;
    delete from sauda.games where id = v_id;
    if not found then raise exception 'not_found'; end if;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'bad_action';
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when data_exception or integrity_constraint_violation then return sauda.fail('bad_input');
end $$;

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
        -- деньги за незакрытые заказы у заблокированного продавца возвращаются покупателям — только решением администратора
        -- и никогда за свою же покупку (модератор блокирует, деньги по спорным заказам решает администратор)
        for r in select id from sauda.orders where adm and seller = t.id and buyer <> u.id and status in ('paid', 'delivered', 'dispute') order by id loop
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
    if exists (select 1 from sauda.promos where code = upper(p->>'code')) then raise exception 'promo_exists'; end if;
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
    elsif v_k in ('pay_kaspi_phone', 'pay_kaspi_name', 'pay_card', 'pay_link', 'pay_note', 'support_contact') then
      if jsonb_typeof(p->'v') <> 'string' or length(p->>'v') > 300 then raise exception 'bad_input'; end if;
      if v_k = 'pay_link' and p->>'v' <> '' and left(p->>'v', 8) <> 'https://' then raise exception 'bad_input'; end if;
      update sauda.config set v = to_jsonb(trim(p->>'v')) where k = v_k;
    elsif v_k = 'pro_prices' then
      if jsonb_typeof(p->'v') <> 'object' then raise exception 'bad_input'; end if;
      update sauda.config set v = p->'v' where k = 'pro_prices';
    elsif v_k in ('fee_pct', 'pro_fee_pct', 'complete_hours', 'complete_hours_auto', 'complete_hours_goods', 'min_withdraw', 'withdraw_fee_pct', 'max_topup',
                'raise_min', 'raise_min_pro', 'ref_pct', 'max_lots', 'max_lots_pro') then
      if jsonb_typeof(p->'v') <> 'number' or (p->>'v')::numeric < 0 then raise exception 'bad_input'; end if;
      if v_k in ('fee_pct', 'pro_fee_pct', 'withdraw_fee_pct', 'ref_pct') and (p->>'v')::numeric > 100 then raise exception 'bad_input'; end if;
      if v_k in ('complete_hours', 'complete_hours_auto', 'complete_hours_goods') and (p->>'v')::numeric < 1 then raise exception 'bad_input'; end if;
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
