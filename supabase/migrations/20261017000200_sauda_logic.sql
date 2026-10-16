-- «Sauda»: внутренние помощники — сессии, деньги, переписка, сделка через гаранта, фоновые задачи.
-- Всё security definer с пустым search_path; снаружи не видно (схема sauda закрыта).

create or replace function sauda.fail(p_code text) returns jsonb
language sql immutable set search_path = '' as $$ select jsonb_build_object('ok', false, 'error', p_code) $$;

create or replace function sauda.cfgn(p_k text) returns numeric
language sql stable security definer set search_path = '' as $$ select (v #>> '{}')::numeric from sauda.config where k = p_k $$;

create or replace function sauda.test_mode() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (v #>> '{}')::boolean from sauda.config where k = 'test_mode'), true)
$$;

-- счёт сервиса: сюда приходит комиссия, отсюда — бонусы и рефералка; он же «Поддержка» в чатах
create or replace function sauda.platform() returns uuid
language sql stable security definer set search_path = '' as $$ select id from sauda.users where login = 'sauda' $$;

create or replace function sauda.new_session(p_user uuid, p_device text) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into sauda.sessions(token_hash, user_id, device)
  values (encode(extensions.digest(t, 'sha256'), 'hex'), p_user, left(coalesce(p_device, ''), 60));
  return t;
end $$;

-- кто это по ключу входа; заодно отмечаем «был в сети»
create or replace function sauda.uid(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a uuid; h text;
begin
  if coalesce(p_token, '') = '' then return null; end if;
  h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select user_id into a from sauda.sessions where token_hash = h;
  if a is not null then
    update sauda.users set last_seen = now() where id = a and last_seen < now() - interval '1 minute';
    update sauda.sessions set last_seen = now() where token_hash = h and last_seen < now() - interval '1 hour';
  end if;
  return a;
end $$;

create or replace function sauda.me(p_token text) returns sauda.users
language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  select * into u from sauda.users where id = sauda.uid(p_token);
  if not found then raise exception 'no_session'; end if;
  if u.banned then raise exception 'banned'; end if;
  return u;
end $$;

create or replace function sauda.rating(u sauda.users) returns numeric
language sql immutable set search_path = '' as $$
  select case when u.reviews > 0 then round(u.stars_sum::numeric / u.reviews, 2) else 0 end
$$;

-- карточка человека для чужих глаз: без баланса и служебного
create or replace function sauda.mini(u sauda.users) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id, 'login', u.login, 'name', u.name, 'avatar', u.avatar,
    'rating', sauda.rating(u), 'reviews', u.reviews, 'sales', u.sales,
    'online', u.last_seen > now() - interval '5 minutes', 'last_seen', u.last_seen,
    'pro', coalesce(u.pro_until > now(), false), 'verified', u.verified, 'demo', u.is_demo,
    'staff', u.role in ('admin', 'moder', 'bot') and not u.is_demo, 'banned', u.banned, 'since', u.created_at)
$$;

create or replace function sauda.card(l sauda.lots, u sauda.users) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'game', l.game, 'section', l.section, 'title', l.title, 'price', l.price, 'old_price', l.old_price,
    'qty', l.qty, 'auto', l.auto, 'needs_id', l.needs_id, 'period_days', l.period_days, 'deliver_mins', l.deliver_mins,
    'city', l.city, 'thumb', l.thumb, 'status', l.status, 'sold', l.sold, 'demo', l.is_demo, 'attrs', l.attrs,
    'raised_at', l.raised_at, 'created_at', l.created_at, 'seller', sauda.mini(u))
$$;

create or replace function sauda.review_json(r sauda.reviews) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'order_id', r.order_id, 'stars', r.stars, 'text', r.text, 'reply', r.reply, 'game', r.game, 'lot_id', r.lot_id,
    'created_at', r.created_at, 'replied_at', r.replied_at,
    'title', (select o.title from sauda.orders o where o.id = r.order_id),
    'amount', (select o.amount from sauda.orders o where o.id = r.order_id),
    'buyer', (select jsonb_build_object('login', b.login, 'name', b.name, 'avatar', b.avatar) from sauda.users b where b.id = r.buyer),
    'seller', (select jsonb_build_object('login', s.login, 'name', s.name, 'avatar', s.avatar) from sauda.users s where s.id = r.seller))
$$;

create or replace function sauda.reviews_of(p_seller uuid, p_limit int, p_offset int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(sauda.review_json(r) order by r.created_at desc), '[]'::jsonb)
  from (select * from sauda.reviews where seller = p_seller order by created_at desc limit p_limit offset p_offset) r
$$;

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
    'period_days', (select l.period_days from sauda.lots l where l.id = o.lot_id))
$$;

-- единственное место, где меняется баланс; каждое движение — строка журнала
create or replace function sauda.money(p_user uuid, p_amount bigint, p_kind text, p_ref bigint default null, p_note text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare b bigint; r text;
begin
  select balance, role into b, r from sauda.users where id = p_user for update;
  if not found then raise exception 'no_user'; end if;
  if b + p_amount < 0 and r <> 'bot' then raise exception 'no_money'; end if;
  update sauda.users set balance = balance + p_amount where id = p_user returning balance into b;
  insert into sauda.tx(user_id, amount, kind, ref, note, balance_after)
  values (p_user, p_amount, p_kind, p_ref, left(coalesce(p_note, ''), 200), b);
  return b;
end $$;

create or replace function sauda.notify(p_user uuid, p_kind text, p_data jsonb, p_link text default '') returns void
language sql security definer set search_path = '' as $$
  insert into sauda.notifs(user_id, kind, data, link) values (p_user, p_kind, coalesce(p_data, '{}'::jsonb), coalesce(p_link, ''));
$$;

create or replace function sauda.notify_staff(p_kind text, p_data jsonb, p_link text default '') returns void
language sql security definer set search_path = '' as $$
  insert into sauda.notifs(user_id, kind, data, link)
  select id, p_kind, coalesce(p_data, '{}'::jsonb), coalesce(p_link, '') from sauda.users where role in ('admin', 'moder') and not banned;
$$;

-- переписка: один диалог на пару людей, заказы упоминаются внутри
create or replace function sauda.chat_of(x uuid, y uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare c bigint; lo uuid := least(x, y); hi uuid := greatest(x, y);
begin
  if x = y then raise exception 'self_chat'; end if;
  select id into c from sauda.chats where a = lo and b = hi;
  if c is null then
    insert into sauda.chats(a, b) values (lo, hi) on conflict (a, b) do nothing returning id into c;
    if c is null then select id into c from sauda.chats where a = lo and b = hi; end if;
  end if;
  return c;
end $$;

-- сообщение; kind = system — тело JSON { k: 'order_paid', … }, текст собирает приложение на языке человека
create or replace function sauda.post(p_chat bigint, p_sender uuid, p_kind text, p_body text, p_order bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare m bigint;
begin
  insert into sauda.messages(chat_id, sender, kind, body, order_id) values (p_chat, p_sender, p_kind, p_body, p_order) returning id into m;
  update sauda.chats set
    last_at = now(),
    last_text = case p_kind when 'image' then '' when 'system' then p_body else left(p_body, 160) end,
    last_kind = p_kind, last_sender = p_sender,
    unread_a = unread_a + case when p_sender is distinct from a then 1 else 0 end,
    unread_b = unread_b + case when p_sender is distinct from b then 1 else 0 end
  where id = p_chat;
  return m;
end $$;

create or replace function sauda.sys(p_buyer uuid, p_seller uuid, p_actor uuid, p_body jsonb, p_order bigint) returns void
language sql security definer set search_path = '' as $$
  select sauda.post(sauda.chat_of(p_buyer, p_seller), p_actor, 'system', p_body::text, p_order);
$$;

-- ───────────── сделка ─────────────
-- оформить заказ: списать деньги покупателя в «заморозку» заказа, снять товар со склада, при автовыдаче — выдать сразу
create or replace function sauda.place_order(p_buyer uuid, p_lot bigint, p_qty int, p_data text, p_sub bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare l sauda.lots; s sauda.users; b sauda.users; amt bigint; oid bigint; n int; items text;
begin
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
  perform sauda.notify(l.seller, 'order_new', jsonb_build_object('id', oid, 'title', l.title, 'amount', amt, 'auto', l.auto), '#/order/' || oid);
  return oid;
end $$;

-- закрыть сделку в пользу продавца: деньги минус комиссия — продавцу, комиссия — сервису, доля — пригласившим
create or replace function sauda.complete(p_order bigint, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
declare o sauda.orders; s sauda.users; b sauda.users; pct numeric; v_fee bigint; bonus bigint; pf uuid := sauda.platform();
begin
  select * into o from sauda.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.status not in ('paid', 'delivered', 'dispute') then raise exception 'bad_status'; end if;
  select * into s from sauda.users where id = o.seller;
  select * into b from sauda.users where id = o.buyer;
  pct := case when s.pro_until > now() then sauda.cfgn('pro_fee_pct') else sauda.cfgn('fee_pct') end;
  v_fee := least(o.amount, round(o.amount * pct / 100.0)::bigint);
  if s.role = 'bot' then v_fee := 0; end if;

  update sauda.orders set status = 'completed', fee = v_fee, closed_at = now(), complete_at = null, resolution = p_by where id = o.id;
  perform sauda.money(o.seller, o.amount - v_fee, 'sale', o.id, o.title);
  if v_fee > 0 then
    perform sauda.money(pf, v_fee, 'fee', o.id, o.title);
    if s.ref_by is not null then
      bonus := floor(v_fee * sauda.cfgn('ref_pct') / 100.0)::bigint;
      if bonus > 0 then
        perform sauda.money(s.ref_by, bonus, 'referral', o.id, s.login);
        perform sauda.money(pf, -bonus, 'referral_out', o.id, s.login);
      end if;
    end if;
    if b.ref_by is not null then
      bonus := floor(v_fee * sauda.cfgn('ref_pct') / 100.0)::bigint;
      if bonus > 0 then
        perform sauda.money(b.ref_by, bonus, 'referral', o.id, b.login);
        perform sauda.money(pf, -bonus, 'referral_out', o.id, b.login);
      end if;
    end if;
  end if;
  update sauda.users set sales = sales + 1 where id = o.seller;
  update sauda.users set purchases = purchases + 1 where id = o.buyer;
  perform sauda.sys(o.buyer, o.seller, case when p_by = 'buyer' then o.buyer else null end,
    jsonb_build_object('k', 'order_completed', 'id', o.id, 'by', split_part(p_by, ':', 1), 'net', o.amount - v_fee), o.id);
  perform sauda.notify(o.seller, 'order_completed', jsonb_build_object('id', o.id, 'title', o.title, 'net', o.amount - v_fee, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  if p_by <> 'buyer' then
    perform sauda.notify(o.buyer, 'order_closed', jsonb_build_object('id', o.id, 'title', o.title, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  end if;
end $$;

-- вернуть деньги покупателю; не выданный товар возвращается на склад
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
  perform sauda.sys(o.buyer, o.seller, case when p_by = 'seller' then o.seller when p_by = 'buyer' then o.buyer else null end,
    jsonb_build_object('k', 'order_refunded', 'id', o.id, 'by', split_part(p_by, ':', 1), 'amount', o.amount), o.id);
  perform sauda.notify(o.buyer, 'order_refunded', jsonb_build_object('id', o.id, 'title', o.title, 'amount', o.amount), '#/order/' || o.id);
  if p_by <> 'seller' then
    perform sauda.notify(o.seller, 'order_refunded_s', jsonb_build_object('id', o.id, 'title', o.title, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  end if;
end $$;

-- ───────────── фоновые задачи ─────────────
-- раз в минуту (pg_cron) и попутно при запросах: автоподтверждение, демо-продавцы, автопродление подписок
create or replace function sauda.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n_done int := 0; n_sub int := 0; oid bigint; per int;
begin
  for r in select id from sauda.orders where status = 'delivered' and complete_at <= now() order by complete_at limit 300 loop
    perform sauda.complete(r.id, 'auto');
    n_done := n_done + 1;
  end loop;

  -- демо-продавцы (только в тестовом режиме) выполняют заказ сами
  for r in select o.id, o.buyer, o.seller from sauda.orders o join sauda.users s on s.id = o.seller
           where o.status = 'paid' and s.is_demo order by o.id limit 100 loop
    update sauda.orders set status = 'delivered',
           payload = 'DEMO-' || upper(encode(extensions.gen_random_bytes(3), 'hex')) || '-' || upper(encode(extensions.gen_random_bytes(3), 'hex')),
           delivered_at = now(), complete_at = now() + interval '10 minutes'
     where id = r.id;
    perform sauda.sys(r.buyer, r.seller, r.seller, jsonb_build_object('k', 'order_delivered', 'id', r.id), r.id);
    perform sauda.notify(r.buyer, 'order_delivered', jsonb_build_object('id', r.id), '#/order/' || r.id);
  end loop;
  -- у демо-лотов с автовыдачей склад не кончается
  insert into sauda.lot_items(lot_id, payload)
  select l.id, 'DEMO-' || upper(encode(extensions.gen_random_bytes(4), 'hex')) || '-' || g
  from sauda.lots l cross join generate_series(1, 20) g
  where l.is_demo and l.auto and l.status in ('active', 'sold')
    and (select count(*) from sauda.lot_items i where i.lot_id = l.id and i.order_id is null) < 5;
  update sauda.lots l set qty = (select count(*) from sauda.lot_items i where i.lot_id = l.id and i.order_id is null),
         status = case when l.status = 'sold' then 'active' else l.status end
   where l.is_demo and l.auto and l.status in ('active', 'sold')
     and (l.status = 'sold' or l.qty is distinct from (select count(*) from sauda.lot_items i where i.lot_id = l.id and i.order_id is null));

  for r in select s.* from sauda.subs s where s.active and s.next_at <= now() order by s.next_at limit 100 loop
    begin
      oid := sauda.place_order(r.buyer, r.lot_id, 1, r.buyer_data, r.id);
      select period_days into per from sauda.lots where id = r.lot_id;
      update sauda.subs set next_at = greatest(r.next_at + make_interval(days => coalesce(per, 30)), now() + interval '1 hour'),
             last_order = oid, fails = 0
       where id = r.id;
      perform sauda.notify(r.buyer, 'sub_renewed', jsonb_build_object('order', oid, 'lot', r.lot_id), '#/order/' || oid);
      n_sub := n_sub + 1;
    exception when raise_exception then
      update sauda.subs set fails = fails + 1, next_at = now() + interval '1 day', active = r.fails + 1 < 3 where id = r.id;
      perform sauda.notify(r.buyer, 'sub_failed', jsonb_build_object('lot', r.lot_id, 'error', sqlerrm, 'stopped', r.fails + 1 >= 3), '#/subs');
    end;
  end loop;
  return jsonb_build_object('completed', n_done, 'renewed', n_sub);
end $$;

create or replace function sauda.maybe_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from sauda.state where id = 1 and last_tick < now() - interval '15 seconds' for update skip locked;
  if found then
    update sauda.state set last_tick = now() where id = 1;
    begin
      perform sauda.tick();
    exception when others then
      raise warning using message = 'sauda.tick: ' || sqlerrm;
    end;
  end if;
end $$;
