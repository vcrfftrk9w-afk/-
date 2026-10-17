-- «Sauda»: вещи с доставкой и защита входа.
--  • Вещи (игры вида goods: девайсы, консоли, смартфоны…) едут по почте дольше 72 часов — заказ подтверждается сам
--    только через complete_hours_goods (по умолчанию 14 дней) после отметки «выполнено», чтобы деньги не ушли продавцу раньше посылки.
--  • Неверный пароль закрывает вход по логину на 15 минут только для того адреса (IP), с которого его подбирали —
--    чужой человек больше не может заблокировать вход владельцу аккаунта.

insert into sauda.config(k, v) values ('complete_hours_goods', '336') on conflict (k) do nothing;

create or replace function sauda.goods_hold() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'delivered' and new.complete_at is not null
     and exists (select 1 from sauda.games g where g.id = new.game and g.kind = 'goods') then
    new.complete_at := greatest(new.complete_at,
      coalesce(new.delivered_at, now()) + make_interval(hours => coalesce(sauda.cfgn('complete_hours_goods'), 336)::int));
  end if;
  return new;
end $$;
drop trigger if exists orders_goods_hold on sauda.orders;
create trigger orders_goods_hold before insert or update of status, complete_at on sauda.orders
  for each row execute function sauda.goods_hold();

-- уже выполненные, но не закрытые заказы на вещи тоже получают полный срок
update sauda.orders set complete_at = complete_at where status = 'delivered' and complete_at is not null;

create table if not exists sauda.login_fails (
  login text not null,
  ip text not null,
  n int not null default 0,
  until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (login, ip)
);
create index if not exists login_fails_updated_idx on sauda.login_fails(updated_at);
revoke all on sauda.login_fails from public, anon, authenticated;

-- адрес того, кто вызывает функцию (Supabase передаёт заголовки запроса; Cloudflare ставит cf-connecting-ip сам)
create or replace function sauda.client_ip() returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''), '')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb h) x
$$;

-- 10 неверных паролей подряд с одного адреса — вход по этому логину с этого адреса закрыт на 15 минут
create or replace function public.sauda_login(p_login text, p_password text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); u sauda.users; v_ip text := sauda.client_ip(); f sauda.login_fails;
begin
  delete from sauda.login_fails where updated_at < now() - interval '1 day';
  select * into f from sauda.login_fails where login = l and ip = v_ip;
  if f.until is not null and f.until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', f.until);
  end if;
  select * into u from sauda.users where login = l and role <> 'bot' and not is_demo;
  if found and u.pass_hash = extensions.crypt(coalesce(p_password, ''), u.pass_hash) then
    delete from sauda.login_fails where login = l and ip = v_ip;
    update sauda.users set last_seen = now() where id = u.id;
    return jsonb_build_object('ok', true, 'token', sauda.new_session(u.id, p_device), 'login', u.login);
  end if;
  insert into sauda.login_fails as x (login, ip, n) values (l, v_ip, 1)
  on conflict (login, ip) do update set n = x.n + 1, updated_at = now(),
    until = case when x.n + 1 >= 10 then now() + interval '15 minutes' else null end;
  return sauda.fail('bad_login');
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
