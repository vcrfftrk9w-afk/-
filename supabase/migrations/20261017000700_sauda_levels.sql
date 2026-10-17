-- «Sauda»: уровни. Каждая завершённая сделка даёт опыт обоим — покупателю и продавцу (1 очко за 100 ₸).
-- С уровнем у продавца ниже комиссия, а покупатель получает кешбэк на баланс — из комиссии сервиса,
-- никогда не больше того, что от неё осталось после реферальных бонусов (сервис не уходит в минус).
-- Пороги и бонусы — в настройке levels (можно менять в базе).

alter table sauda.users add column if not exists xp bigint not null default 0;

-- опыт за сделки, завершённые до появления уровней
update sauda.users u set xp = coalesce((select sum(o.amount) / 100 from sauda.orders o
  where o.status = 'completed' and u.id in (o.buyer, o.seller)), 0)
 where not u.is_demo and u.role <> 'bot' and u.xp = 0;

insert into sauda.config(k, v) values
  ('levels', '[{"xp": 0, "fee_off": 0, "cashback": 0},
               {"xp": 100, "fee_off": 0.5, "cashback": 0.5},
               {"xp": 500, "fee_off": 1, "cashback": 1},
               {"xp": 2000, "fee_off": 1.5, "cashback": 1.5},
               {"xp": 10000, "fee_off": 2, "cashback": 2}]')
on conflict (k) do nothing;

-- уровень 1…5 по опыту
create or replace function sauda.level(p_xp bigint) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(1, (select count(*)::int from jsonb_array_elements((select v from sauda.config where k = 'levels')) e
                      where (e->>'xp')::bigint <= coalesce(p_xp, 0)))
$$;

-- бонус уровня: fee_off — на сколько пунктов ниже комиссия продавца, cashback — % кешбэка покупателю
create or replace function sauda.perk(p_xp bigint, p_key text) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(((select v from sauda.config where k = 'levels') -> (sauda.level(p_xp) - 1) ->> p_key)::numeric, 0)
$$;

-- комиссия продавца: с Pro — как у Pro; иначе обычная минус бонус уровня, но не ниже, чем у Pro
create or replace function sauda.fee_pct(u sauda.users) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when u.pro_until > now() then sauda.cfgn('pro_fee_pct')
              else greatest(sauda.cfgn('fee_pct') - sauda.perk(u.xp, 'fee_off'), least(sauda.cfgn('pro_fee_pct'), sauda.cfgn('fee_pct'))) end
$$;

create or replace function sauda.mini(u sauda.users) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id, 'login', u.login, 'name', u.name, 'avatar', u.avatar,
    'rating', sauda.rating(u), 'reviews', u.reviews, 'sales', u.sales,
    'online', u.last_seen > now() - interval '5 minutes', 'last_seen', u.last_seen,
    'pro', coalesce(u.pro_until > now(), false), 'verified', u.verified, 'demo', u.is_demo,
    'staff', u.role in ('admin', 'moder', 'bot') and not u.is_demo, 'banned', u.banned, 'since', u.created_at,
    'level', case when u.is_demo or u.role = 'bot' then 0 else sauda.level(u.xp) end)
$$;

-- закрыть сделку в пользу продавца: деньги минус комиссия — продавцу, комиссия — сервису, доля — пригласившим,
-- кешбэк — покупателю по его уровню; обоим — опыт
create or replace function sauda.complete(p_order bigint, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
declare o sauda.orders; s sauda.users; b sauda.users; v_fee bigint; bonus bigint; rest bigint; cb bigint := 0; gain bigint; pf uuid := sauda.platform();
begin
  select * into o from sauda.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.status not in ('paid', 'delivered', 'dispute') then raise exception 'bad_status'; end if;
  select * into s from sauda.users where id = o.seller;
  select * into b from sauda.users where id = o.buyer;
  v_fee := least(o.amount, round(o.amount * sauda.fee_pct(s) / 100.0)::bigint);
  if s.role = 'bot' then v_fee := 0; end if;

  update sauda.orders set status = 'completed', fee = v_fee, closed_at = now(), complete_at = null, resolution = p_by where id = o.id;
  perform sauda.money(o.seller, o.amount - v_fee, 'sale', o.id, o.title);
  rest := v_fee;
  if v_fee > 0 then
    perform sauda.money(pf, v_fee, 'fee', o.id, o.title);
    if s.ref_by is not null then
      bonus := floor(v_fee * sauda.cfgn('ref_pct') / 100.0)::bigint;
      if bonus > 0 then
        perform sauda.money(s.ref_by, bonus, 'referral', o.id, s.login);
        perform sauda.money(pf, -bonus, 'referral_out', o.id, s.login);
        rest := rest - bonus;
      end if;
    end if;
    if b.ref_by is not null then
      bonus := floor(v_fee * sauda.cfgn('ref_pct') / 100.0)::bigint;
      if bonus > 0 then
        perform sauda.money(b.ref_by, bonus, 'referral', o.id, b.login);
        perform sauda.money(pf, -bonus, 'referral_out', o.id, b.login);
        rest := rest - bonus;
      end if;
    end if;
    if not b.is_demo then
      cb := greatest(0, least(floor(o.amount * sauda.perk(b.xp, 'cashback') / 100.0)::bigint, rest));
      if cb > 0 then
        perform sauda.money(o.buyer, cb, 'cashback', o.id, o.title);
        perform sauda.money(pf, -cb, 'cashback_out', o.id, b.login);
      end if;
    end if;
  end if;

  gain := o.amount / 100;
  update sauda.users set sales = sales + 1, xp = xp + case when is_demo or role = 'bot' then 0 else gain end where id = o.seller;
  update sauda.users set purchases = purchases + 1, xp = xp + case when is_demo or role = 'bot' then 0 else gain end where id = o.buyer;
  if not s.is_demo and s.role <> 'bot' and sauda.level(s.xp + gain) > sauda.level(s.xp) then
    perform sauda.notify(o.seller, 'level_up', jsonb_build_object('level', sauda.level(s.xp + gain)), '#/me');
  end if;
  if not b.is_demo and sauda.level(b.xp + gain) > sauda.level(b.xp) then
    perform sauda.notify(o.buyer, 'level_up', jsonb_build_object('level', sauda.level(b.xp + gain)), '#/me');
  end if;

  perform sauda.sys(o.buyer, o.seller, case when p_by = 'buyer' then o.buyer else null end,
    jsonb_build_object('k', 'order_completed', 'id', o.id, 'by', split_part(p_by, ':', 1), 'net', o.amount - v_fee), o.id);
  perform sauda.notify(o.seller, 'order_completed', jsonb_build_object('id', o.id, 'title', o.title, 'net', o.amount - v_fee, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  if p_by <> 'buyer' then
    perform sauda.notify(o.buyer, 'order_closed', jsonb_build_object('id', o.id, 'title', o.title, 'by', split_part(p_by, ':', 1)), '#/order/' || o.id);
  end if;
  if cb > 0 then
    perform sauda.notify(o.buyer, 'cashback', jsonb_build_object('id', o.id, 'amount', cb), '#/wallet');
  end if;
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
              'xp', u.xp, 'fee_pct', sauda.fee_pct(u), 'cashback_pct', sauda.perk(u.xp, 'cashback')),
    'unread', (select coalesce(sum(case when c.a = u.id then c.unread_a else c.unread_b end), 0) from sauda.chats c where c.a = u.id or c.b = u.id),
    'notifs', (select count(*) from sauda.notifs where user_id = u.id and not read),
    'active_buy', (select count(*) from sauda.orders where buyer = u.id and status in ('paid', 'delivered', 'dispute')),
    'active_sell', (select count(*) from sauda.orders where seller = u.id and status in ('paid', 'dispute')),
    'test_mode', sauda.test_mode());
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_stats(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true,
    'days', (select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'n', coalesce(x.n, 0), 'sum', coalesce(x.s, 0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone 'Asia/Almaty')::date - 29, (now() at time zone 'Asia/Almaty')::date, interval '1 day') d
      left join (select (closed_at at time zone 'Asia/Almaty')::date dd, count(*) n, sum(amount - fee) s from sauda.orders
                 where seller = u.id and status = 'completed' and closed_at > now() - interval '31 days' group by 1) x on x.dd = d::date),
    'revenue', (select coalesce(sum(amount - fee), 0) from sauda.orders where seller = u.id and status = 'completed'),
    'revenue_30', (select coalesce(sum(amount - fee), 0) from sauda.orders where seller = u.id and status = 'completed' and closed_at > now() - interval '30 days'),
    'orders', (select count(*) from sauda.orders where seller = u.id),
    'completed', u.sales, 'rating', sauda.rating(u), 'reviews', u.reviews,
    'refunded', (select count(*) from sauda.orders where seller = u.id and status = 'refunded'),
    'pending', (select coalesce(sum(amount), 0) from sauda.orders where seller = u.id and status in ('paid', 'delivered', 'dispute')),
    'lots_active', (select count(*) from sauda.lots where seller = u.id and status = 'active'),
    'views', (select coalesce(sum(views), 0) from sauda.lots where seller = u.id and status <> 'deleted'),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'sold', sold, 'views', views, 'price', price) order by sold desc), '[]'::jsonb)
            from (select * from sauda.lots where seller = u.id and status <> 'deleted' order by sold desc, views desc limit 5) t),
    'fee_pct', sauda.fee_pct(u));
exception when raise_exception then return sauda.fail(sqlerrm);
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
