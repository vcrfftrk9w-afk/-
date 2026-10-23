-- «Sauda»: исправления после проверки денег и безопасности.
--  1. Запуск с настоящими деньгами не пропускает тестовые деньги, которые пришли в ту же секунду: go_live держит
--     замок 4711002, а пополнение, оформление заказа, фоновые задачи и любое движение денег ждут его (общий замок).
--  2. При запуске обнуляются и уровни/рейтинги, набранные на тестовых деньгах; тестовые отзывы удаляются.
--  3. Модератор при блокировке продавца не возвращает деньги автоматически (это делает администратор), и никто
--     не возвращает так деньги за свою же покупку.
--  4. Покупка проверяет цену, которую видел покупатель: продавец не может поднять её в последний момент.
--  5. Блокировка входа: попытка считается до проверки пароля (параллельные попытки тоже), после 15 минут счёт с нуля.
--  6. Настройки: цены Pro — только целые положительные, реферальная доля — не больше 50 %.
--  7. Пустые значения в запросах дают понятную ошибку, а не сбой.

create or replace function sauda.money(p_user uuid, p_amount bigint, p_kind text, p_ref bigint default null, p_note text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare b bigint; r text;
begin
  -- пока идёт запуск с настоящими деньгами, деньги не двигаются
  perform pg_advisory_xact_lock_shared(4711002);
  select balance, role into b, r from sauda.users where id = p_user for update;
  if not found then raise exception 'no_user'; end if;
  if b + p_amount < 0 and r <> 'bot' then raise exception 'no_money'; end if;
  update sauda.users set balance = balance + p_amount where id = p_user returning balance into b;
  insert into sauda.tx(user_id, amount, kind, ref, note, balance_after)
  values (p_user, p_amount, p_kind, p_ref, left(coalesce(p_note, ''), 200), b);
  return b;
end $$;

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
  perform sauda.notify(l.seller, 'order_new', jsonb_build_object('id', oid, 'title', l.title, 'amount', amt, 'auto', l.auto), '#/order/' || oid);
  return oid;
end $$;

create or replace function sauda.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n_done int := 0; n_sub int := 0; oid bigint; l sauda.lots; tm boolean; stop boolean;
begin
  -- cron и попутный запуск не работают одновременно — иначе подписка продлится дважды
  if not pg_try_advisory_xact_lock(4711001) then return jsonb_build_object('skipped', true); end if;
  perform pg_advisory_xact_lock_shared(4711002);
  tm := sauda.test_mode();

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

create or replace function sauda.go_live() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  -- один запуск за раз; ждём, пока закончатся начатые операции с деньгами, и сразу выключаем тестовый режим
  perform pg_advisory_xact_lock(4711002);
  if not sauda.test_mode() then return; end if;
  update sauda.config set v = 'false' where k = 'test_mode';
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
  -- уровни и рейтинг, набранные на тестовых деньгах, не переходят в боевой режим
  delete from sauda.reviews;
  update sauda.users set xp = 0, sales = 0, purchases = 0, reviews = 0, stars_sum = 0
   where xp <> 0 or sales <> 0 or purchases <> 0 or reviews <> 0 or stars_sum <> 0;
  for r in select id from sauda.users where balance <> 0 order by id loop
    perform sauda.money(r.id, -(select balance from sauda.users where id = r.id), 'test_reset', null, '');
  end loop;
  update sauda.config set v = to_jsonb(now()) where k = 'live_since';
end $$;

create or replace function public.sauda_topup(p_token text, p_amount bigint, p_method text default 'kaspi')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; tid bigint; today bigint; x sauda.topups;
begin
  perform pg_advisory_xact_lock_shared(4711002);
  u := sauda.me(p_token);
  if coalesce(p_method, '') not in ('kaspi', 'halyk', 'card', 'freedom', 'apple', 'google', 'link') then raise exception 'bad_input'; end if;
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

-- покупка: p_price — цена, которую видел покупатель; если продавец успел её изменить — отказ, ничего не списано
drop function if exists public.sauda_buy(text, bigint, int, text, boolean);
create or replace function public.sauda_buy(p_token text, p_lot bigint, p_qty int default 1, p_data text default '', p_renew boolean default false, p_price bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; oid bigint; sid bigint; pd int; pr bigint;
begin
  u := sauda.me(p_token);
  oid := sauda.place_order(u.id, p_lot, p_qty, p_data);
  if p_price is not null and (select unit_price from sauda.orders where id = oid) <> p_price then raise exception 'price_changed'; end if;
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

create or replace function public.sauda_login(p_login text, p_password text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); u sauda.users; v_ip text := sauda.client_ip(); f sauda.login_fails;
begin
  delete from sauda.login_fails where updated_at < now() - interval '1 day';
  -- попытка засчитывается до проверки пароля и под замком строки — параллельные попытки тоже считаются;
  -- после окончания блокировки счёт начинается заново
  insert into sauda.login_fails as x (login, ip, n) values (l, v_ip, 1)
  on conflict (login, ip) do update set
    n = case when x.until is not null and x.until <= now() then 1 else x.n + 1 end,
    until = case when x.until is not null and x.until <= now() then null else x.until end,
    updated_at = now()
  returning * into f;
  if f.until is not null and f.until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', f.until);
  end if;
  if f.n > 10 then
    update sauda.login_fails set until = now() + interval '15 minutes' where login = l and ip = v_ip returning * into f;
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', f.until);
  end if;
  select * into u from sauda.users where login = l and role <> 'bot' and not is_demo;
  if found and u.pass_hash = extensions.crypt(coalesce(p_password, ''), u.pass_hash) then
    delete from sauda.login_fails where login = l and ip = v_ip;
    update sauda.users set last_seen = now() where id = u.id;
    return jsonb_build_object('ok', true, 'token', sauda.new_session(u.id, p_device), 'login', u.login);
  end if;
  if f.n >= 10 then update sauda.login_fails set until = now() + interval '15 minutes' where login = l and ip = v_ip; end if;
  return sauda.fail('bad_login');
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
        'sections', x.sections, 'logo', x.logo,
        'lots', (select count(*) from sauda.lots l where l.game = x.id and l.status <> 'deleted')) order by x.kind, x.sort, x.name), '[]'::jsonb)
      from sauda.games x));

  elsif p_action = 'save' then
    if v_id !~ '^[a-z0-9_]{2,24}$' then raise exception 'bad_game_id'; end if;
    if p ? 'name' and length(trim(p->>'name')) not between 1 and 40 then raise exception 'bad_title'; end if;
    if p ? 'kind' and p->>'kind' not in ('mobile', 'pc', 'subs', 'social', 'service', 'goods') then raise exception 'bad_input'; end if;
    if p ? 'emoji' and length(p->>'emoji') not between 1 and 8 then raise exception 'bad_input'; end if;
    if p ? 'color' and p->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_input'; end if;
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
    if not found then
      if not (p ? 'name' and p ? 'kind' and p ? 'sections') then raise exception 'bad_input'; end if;
      insert into sauda.games(id, name, kind, emoji, color, sort, popular, sections, logo)
      values (v_id, trim(p->>'name'), p->>'kind', coalesce(nullif(p->>'emoji', ''), '🎮'), coalesce(p->>'color', '#00afca'),
              coalesce((p->>'sort')::int, 500), coalesce((p->>'popular')::boolean, false), v_secs, coalesce(p->>'logo', ''));
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
        logo = coalesce(p->>'logo', logo)
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

create or replace function public.sauda_lot_set(p_token text, p_id bigint, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; l sauda.lots;
begin
  u := sauda.me(p_token);
  select * into l from sauda.lots where id = p_id for update;
  if not found or l.seller <> u.id or l.status = 'deleted' then raise exception 'not_found'; end if;
  if l.status = 'blocked' then raise exception 'lot_blocked'; end if;
  if p_status not in ('active', 'paused', 'deleted') then raise exception 'bad_input'; end if;
  if p_status = 'active' and l.qty is not null and l.qty <= 0 then raise exception 'not_enough_stock'; end if;
  update sauda.lots set status = p_status, updated_at = now(),
         raised_at = case when p_status = 'active' and l.status <> 'active' then now() else raised_at end
   where id = p_id;
  if p_status = 'deleted' then
    delete from sauda.lot_items where lot_id = p_id and order_id is null;
    update sauda.subs set active = false where lot_id = p_id;
  end if;
  return jsonb_build_object('ok', true);
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when not_null_violation or check_violation then return sauda.fail('bad_input');
end $$;

create or replace function public.sauda_report(p_token text, p_kind text, p_target text, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; txt text := trim(coalesce(p_text, ''));
begin
  u := sauda.me(p_token);
  if p_kind not in ('lot', 'user', 'order') then raise exception 'bad_input'; end if;
  if length(txt) < 5 or length(txt) > 1000 then raise exception 'need_reason'; end if;
  if (select count(*) from sauda.reports where user_id = u.id and created_at > now() - interval '1 day') >= 20 then raise exception 'slow_down'; end if;
  insert into sauda.reports(user_id, kind, target, text) values (u.id, p_kind, left(coalesce(p_target, ''), 64), txt);
  perform sauda.notify_staff('report_new', jsonb_build_object('kind', p_kind, 'target', p_target), '#/admin/reports');
  return jsonb_build_object('ok', true);
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when not_null_violation or check_violation then return sauda.fail('bad_input');
end $$;

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
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when not_null_violation or check_violation then return sauda.fail('bad_input');
end $$;

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
exception
  when raise_exception then return sauda.fail(sqlerrm);
  when not_null_violation or check_violation then return sauda.fail('bad_input');
end $$;

-- настройки: цены Pro — целые положительные (иначе Pro «за минус» начислял бы деньги), реферальная доля — не больше 50 %
create or replace function sauda.config_check() returns trigger
language plpgsql set search_path = '' as $$
declare e record;
begin
  if new.k = 'pro_prices' then
    if jsonb_typeof(new.v) <> 'object' then raise exception 'bad_input'; end if;
    for e in select * from jsonb_each(new.v) loop
      if e.key !~ '^[0-9]{1,2}$' or e.key::int not between 1 and 36 or jsonb_typeof(e.value) <> 'number'
         or (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric) or (e.value #>> '{}')::numeric not between 1 and 10000000 then
        raise exception 'bad_input';
      end if;
    end loop;
  elsif new.k = 'ref_pct' and (jsonb_typeof(new.v) <> 'number' or (new.v #>> '{}')::numeric > 50) then
    raise exception 'bad_input';
  end if;
  return new;
end $$;
drop trigger if exists config_check on sauda.config;
create trigger config_check before insert or update on sauda.config for each row execute function sauda.config_check();

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
