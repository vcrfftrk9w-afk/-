-- «Sauda»: панель администратора и модератора. Один вход: sauda_admin(p_token, p_action, p).
-- Модератор: споры, лоты, жалобы, поддержка. Администратор: ещё выводы, баланс, роли, промокоды, настройки.

-- стать администратором по коду из sauda.config (admin_code) — код знает только владелец базы
create or replace function public.sauda_admin_claim(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if coalesce(trim(p_code), '') = '' or trim(p_code) <> (select v #>> '{}' from sauda.config where k = 'admin_code') then
    raise exception 'bad_code';
  end if;
  update sauda.users set role = 'admin' where id = u.id;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_admin(p_token text, p_action text, p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u sauda.users; adm boolean; o sauda.orders; w sauda.withdrawals; t sauda.users; res jsonb; pf uuid := sauda.platform();
  q text := lower(trim(coalesce(p->>'q', ''))); amt bigint; peer uuid;
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
      'withdrawals', (select count(*) from sauda.withdrawals where status = 'pending'),
      'withdrawals_sum', (select coalesce(sum(amount), 0) from sauda.withdrawals where status = 'pending'),
      'reports', (select count(*) from sauda.reports where status = 'open'),
      'support', (select coalesce(sum(case when c.a = pf then c.unread_a else c.unread_b end), 0) from sauda.chats c where c.a = pf or c.b = pf),
      'pro_users', (select count(*) from sauda.users where pro_until > now()),
      'days', (select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'n', coalesce(x.n, 0), 'sum', coalesce(x.s, 0)) order by d), '[]'::jsonb)
        from generate_series((now() at time zone 'Asia/Almaty')::date - 13, (now() at time zone 'Asia/Almaty')::date, interval '1 day') d
        left join (select (created_at at time zone 'Asia/Almaty')::date dd, count(*) n, sum(amount) s from sauda.orders
                   where created_at > now() - interval '15 days' group by 1) x on x.dd = d::date),
      'test_mode', sauda.test_mode());

  elsif p_action = 'orders' then
    res := (select coalesce(jsonb_agg(sauda.order_json(x, u.id) order by x.id desc), '[]'::jsonb) from (
      select o2.* from sauda.orders o2
      where (coalesce(p->>'status', '') = '' or o2.status = p->>'status')
        and (q = '' or o2.id::text = q or lower(o2.title) like '%' || q || '%'
             or exists (select 1 from sauda.users z where z.id in (o2.buyer, o2.seller) and z.login = q))
      order by o2.id desc limit 100) x);

  elsif p_action = 'disputes' then
    res := (select coalesce(jsonb_agg(sauda.order_json(x, u.id) order by x.id), '[]'::jsonb) from sauda.orders x where x.status = 'dispute');

  elsif p_action = 'chat_between' then
    -- переписка покупателя и продавца по спору; непрочитанные у них не сбрасываем
    res := sauda.chat_read((p->>'a')::uuid, (p->>'b')::uuid, 0, null, false);

  elsif p_action = 'resolve' then
    select * into o from sauda.orders where id = (p->>'id')::bigint;
    if not found then raise exception 'not_found'; end if;
    if p->>'winner' = 'buyer' then perform sauda.refund(o.id, 'admin:' || left(coalesce(p->>'note', ''), 200));
    elsif p->>'winner' = 'seller' then perform sauda.complete(o.id, 'admin:' || left(coalesce(p->>'note', ''), 200));
    else raise exception 'bad_input'; end if;
    perform sauda.sys(o.buyer, o.seller, null, jsonb_build_object('k', 'dispute_resolved', 'id', o.id, 'winner', p->>'winner',
      'note', left(coalesce(p->>'note', ''), 200)), o.id);
    res := jsonb_build_object('done', true);

  elsif p_action = 'withdrawals' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'amount', x.amount, 'fee', x.fee, 'method', x.method, 'details', x.details,
              'status', x.status, 'note', x.note, 'test', x.test, 'created_at', x.created_at, 'processed_at', x.processed_at,
              'user', sauda.mini(z)) order by x.id desc), '[]'::jsonb)
            from (select * from sauda.withdrawals where coalesce(p->>'status', 'pending') = 'all' or status = coalesce(p->>'status', 'pending')
                  order by id desc limit 200) x join sauda.users z on z.id = x.user_id);

  elsif p_action = 'withdraw_set' then
    if not adm then raise exception 'forbidden'; end if;
    select * into w from sauda.withdrawals where id = (p->>'id')::bigint for update;
    if not found or w.status <> 'pending' then raise exception 'bad_status'; end if;
    if p->>'status' = 'done' then
      update sauda.withdrawals set status = 'done', processed_at = now(), note = left(coalesce(p->>'note', ''), 200) where id = w.id;
      if w.fee > 0 then perform sauda.money(pf, w.fee, 'withdraw_fee', w.id, ''); end if;
      perform sauda.notify(w.user_id, 'withdraw_done', jsonb_build_object('id', w.id, 'amount', w.amount - w.fee), '#/wallet');
    elsif p->>'status' = 'rejected' then
      update sauda.withdrawals set status = 'rejected', processed_at = now(), note = left(coalesce(p->>'note', ''), 200) where id = w.id;
      perform sauda.money(w.user_id, w.amount, 'withdraw_back', w.id, coalesce(p->>'note', ''));
      perform sauda.notify(w.user_id, 'withdraw_rejected', jsonb_build_object('id', w.id, 'amount', w.amount, 'note', coalesce(p->>'note', '')), '#/wallet');
    else raise exception 'bad_input'; end if;
    res := jsonb_build_object('done', true);

  elsif p_action = 'users' then
    res := (select coalesce(jsonb_agg(sauda.mini(z) || jsonb_build_object('balance', z.balance, 'role', z.role, 'ban_reason', z.ban_reason,
              'purchases', z.purchases, 'pro_until', z.pro_until) order by z.created_at desc), '[]'::jsonb)
            from (select * from sauda.users where (q = '' or login like '%' || q || '%' or lower(name) like '%' || q || '%')
                  and role <> 'bot' order by created_at desc limit 100) z);

  elsif p_action = 'user_set' then
    select * into t from sauda.users where id = (p->>'id')::uuid for update;
    if not found or t.role = 'bot' then raise exception 'not_found'; end if;
    if t.role = 'admin' and not adm then raise exception 'forbidden'; end if;
    if p ? 'banned' then
      update sauda.users set banned = (p->>'banned')::boolean, ban_reason = left(coalesce(p->>'ban_reason', ''), 200) where id = t.id;
      if (p->>'banned')::boolean then
        delete from sauda.sessions where user_id = t.id;
        update sauda.lots set status = 'paused' where seller = t.id and status = 'active';
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
        select * from sauda.lots x where (coalesce(p->>'status', '') = '' or x.status = p->>'status')
          and (q = '' or x.id::text = q or lower(x.title) like '%' || q || '%') and not x.is_demo
        order by x.created_at desc limit 100) l join sauda.users z on z.id = l.seller);

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
    res := (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'target', r.target, 'text', r.text, 'status', r.status,
              'created_at', r.created_at, 'user', sauda.mini(z)) order by r.id desc), '[]'::jsonb)
            from (select * from sauda.reports where status = coalesce(nullif(p->>'status', ''), 'open') order by id desc limit 100) r
            join sauda.users z on z.id = r.user_id);

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
    insert into sauda.promos(code, amount, uses_left, expires_at)
    values (upper(p->>'code'), (p->>'amount')::bigint, coalesce((p->>'uses')::int, 1),
            case when coalesce((p->>'days')::int, 0) > 0 then now() + make_interval(days => (p->>'days')::int) end);
    res := jsonb_build_object('done', true);

  elsif p_action = 'config' then
    if not adm then raise exception 'forbidden'; end if;
    res := (select jsonb_object_agg(k, v) from sauda.config where k <> 'admin_code');

  elsif p_action = 'config_set' then
    if not adm then raise exception 'forbidden'; end if;
    if p->>'k' not in ('fee_pct', 'pro_fee_pct', 'test_mode', 'pro_prices', 'complete_hours', 'complete_hours_auto', 'min_withdraw',
                       'withdraw_fee_pct', 'max_topup', 'raise_min', 'raise_min_pro', 'ref_pct', 'max_lots', 'max_lots_pro') then
      raise exception 'bad_input';
    end if;
    if p->>'k' = 'test_mode' and jsonb_typeof(p->'v') <> 'boolean' then raise exception 'bad_input'; end if;
    if p->>'k' = 'pro_prices' and jsonb_typeof(p->'v') <> 'object' then raise exception 'bad_input'; end if;
    if p->>'k' not in ('test_mode', 'pro_prices') and (jsonb_typeof(p->'v') <> 'number' or (p->>'v')::numeric < 0) then raise exception 'bad_input'; end if;
    update sauda.config set v = p->'v' where k = p->>'k';
    res := jsonb_build_object('done', true);

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
