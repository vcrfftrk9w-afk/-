-- «Sauda»: функции, которые зовёт приложение (POST /rest/v1/rpc/sauda_*).
-- Ответ всегда { ok: true, … } или { ok: false, error: 'код' }. Ключ входа — p_token.

-- ═════════════ вход ═════════════
create or replace function public.sauda_register(p_login text, p_password text, p_name text default '', p_ref text default '', p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); n text := trim(coalesce(p_name, '')); u uuid; r uuid;
begin
  if l !~ '^[a-z0-9_.-]{3,24}$' then raise exception 'bad_login_format'; end if;
  if l in ('sauda', 'admin', 'support', 'moder', 'root', 'system', 'help', 'podderzhka', 'administrator') then raise exception 'login_taken'; end if;
  if length(coalesce(p_password, '')) < 6 or length(p_password) > 72 then raise exception 'bad_password'; end if;
  if n = '' then n := l; end if;
  if length(n) > 32 then raise exception 'bad_name'; end if;
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

-- 10 неверных паролей подряд — вход по этому логину закрыт на 15 минут
create or replace function public.sauda_login(p_login text, p_password text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l text := lower(trim(coalesce(p_login, ''))); u sauda.users;
begin
  select * into u from sauda.users where login = l and role <> 'bot' and not is_demo;
  if not found then return sauda.fail('bad_login'); end if;
  if u.locked_until is not null and u.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked', 'until', u.locked_until);
  end if;
  if u.pass_hash = extensions.crypt(coalesce(p_password, ''), u.pass_hash) then
    update sauda.users set fails = 0, locked_until = null, last_seen = now() where id = u.id;
    return jsonb_build_object('ok', true, 'token', sauda.new_session(u.id, p_device), 'login', u.login);
  end if;
  update sauda.users
     set fails = case when u.fails + 1 >= 10 then 0 else u.fails + 1 end,
         locked_until = case when u.fails + 1 >= 10 then now() + interval '15 minutes' else null end
   where id = u.id;
  return sauda.fail('bad_login');
end $$;

create or replace function public.sauda_logout(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  delete from sauda.sessions where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.sauda_password(p_token text, p_old text, p_new text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if u.pass_hash <> extensions.crypt(coalesce(p_old, ''), u.pass_hash) then raise exception 'bad_password_old'; end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then raise exception 'bad_password'; end if;
  update sauda.users set pass_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = u.id;
  delete from sauda.sessions where user_id = u.id and token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ я ═════════════
create or replace function public.sauda_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  perform sauda.maybe_tick();
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true,
    'user', sauda.mini(u) || jsonb_build_object('balance', u.balance, 'bio', u.bio, 'city', u.city, 'lang', u.lang,
              'role', u.role, 'pro_until', u.pro_until, 'ref_code', u.ref_code, 'purchases', u.purchases),
    'unread', (select coalesce(sum(case when c.a = u.id then c.unread_a else c.unread_b end), 0) from sauda.chats c where c.a = u.id or c.b = u.id),
    'notifs', (select count(*) from sauda.notifs where user_id = u.id and not read),
    'active_buy', (select count(*) from sauda.orders where buyer = u.id and status in ('paid', 'delivered', 'dispute')),
    'active_sell', (select count(*) from sauda.orders where seller = u.id and status in ('paid', 'dispute')),
    'test_mode', sauda.test_mode());
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
  if length(v_bio) > 600 then raise exception 'too_long'; end if;
  if length(v_city) > 40 then raise exception 'too_long'; end if;
  if v_av <> '' and (v_av !~ '^data:image/(png|jpeg|webp|gif);base64,' or length(v_av) > 60000) then raise exception 'bad_image'; end if;
  if v_lang not in ('ru', 'kz') then raise exception 'bad_input'; end if;
  update sauda.users set name = v_name, bio = v_bio, city = v_city, avatar = v_av, lang = v_lang where id = u.id;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ витрина ═════════════
create or replace function public.sauda_meta()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tm boolean := sauda.test_mode();
begin
  return jsonb_build_object('ok', true,
    'games', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'kind', g.kind, 'emoji', g.emoji, 'color', g.color, 'popular', g.popular, 'sections', g.sections,
        'counts', coalesce((select jsonb_object_agg(x.section, x.n) from (
            select l.section, count(*) n from sauda.lots l
            where l.game = g.id and l.status = 'active' and (tm or not l.is_demo) group by l.section) x), '{}'::jsonb))
      order by g.sort, g.name), '[]'::jsonb) from sauda.games g),
    'config', (select jsonb_object_agg(k, v) from sauda.config where k <> 'admin_code'));
end $$;

create or replace function public.sauda_home()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tm boolean := sauda.test_mode();
begin
  return jsonb_build_object('ok', true,
    'hot', (select coalesce(jsonb_agg(sauda.card(l, u) order by x.rn), '[]'::jsonb) from (
        select l.id, row_number() over (order by l.sold desc, l.raised_at desc) rn
        from sauda.lots l join sauda.users u on u.id = l.seller
        where l.status = 'active' and not u.banned and (tm or not l.is_demo) order by rn limit 12) x
      join sauda.lots l on l.id = x.id join sauda.users u on u.id = l.seller),
    'fresh', (select coalesce(jsonb_agg(sauda.card(l, u) order by x.rn), '[]'::jsonb) from (
        select l.id, row_number() over (order by l.created_at desc) rn
        from sauda.lots l join sauda.users u on u.id = l.seller
        where l.status = 'active' and not u.banned and (tm or not l.is_demo) order by rn limit 12) x
      join sauda.lots l on l.id = x.id join sauda.users u on u.id = l.seller),
    'reviews', (select coalesce(jsonb_agg(sauda.review_json(r) order by r.created_at desc), '[]'::jsonb)
                from (select * from sauda.reviews where stars >= 4 and text <> '' order by created_at desc limit 8) r),
    'stats', jsonb_build_object(
      'users', (select count(*) from sauda.users where role <> 'bot' and not is_demo),
      'lots', (select count(*) from sauda.lots where status = 'active' and (tm or not is_demo)),
      'deals', (select count(*) from sauda.orders where status = 'completed'),
      'online', (select count(*) from sauda.users where last_seen > now() - interval '5 minutes' and role <> 'bot' and not is_demo)));
end $$;

-- поиск и список лотов. p: { game, section, kind, q, min, max, auto, online, seller, city, sort, limit, offset }
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
      and (q is null or strpos(lower(l.title), q) > 0 or strpos(lower(l.descr), q) > 0 or strpos(lower(gg.name), q) > 0)
      and (mn is null or l.price >= mn) and (mx is null or l.price <= mx)
      and (not au or l.auto) and (not onl or u.last_seen > now() - interval '5 minutes')
      and (sel is null or u.login = sel) and (ct is null or l.city = ct)
    order by rn limit lim offset off
  ) x
  join sauda.lots l on l.id = x.id join sauda.users u on u.id = l.seller;
  return jsonb_build_object('ok', true, 'items', res, 'total', total);
exception when data_exception then return sauda.fail('bad_input');
end $$;

create or replace function public.sauda_lot(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := sauda.uid(p_token); l sauda.lots; u sauda.users; staff boolean;
begin
  select * into l from sauda.lots where id = p_id;
  if not found then raise exception 'not_found'; end if;
  staff := exists (select 1 from sauda.users where id = me and role in ('admin', 'moder'));
  if (l.status in ('deleted', 'blocked') or (l.is_demo and not sauda.test_mode())) and me is distinct from l.seller and not staff then
    raise exception 'not_found';
  end if;
  select * into u from sauda.users where id = l.seller;
  if me is distinct from l.seller then update sauda.lots set views = views + 1 where id = p_id; end if;
  return jsonb_build_object('ok', true,
    'lot', sauda.card(l, u) || jsonb_build_object('descr', l.descr, 'images', l.images, 'id_label', l.id_label,
             'views', l.views, 'updated_at', l.updated_at),
    'seller', sauda.mini(u) || jsonb_build_object('bio', u.bio, 'city', u.city),
    'reviews', sauda.reviews_of(u.id, 5, 0),
    'similar', (select coalesce(jsonb_agg(sauda.card(l2, u2) order by l2.raised_at desc), '[]'::jsonb) from (
        select * from sauda.lots x where x.game = l.game and x.section = l.section and x.id <> l.id and x.status = 'active'
          and (sauda.test_mode() or not x.is_demo) order by x.raised_at desc limit 8) l2
      join sauda.users u2 on u2.id = l2.seller where not u2.banned),
    'fav', exists (select 1 from sauda.favs where user_id = me and lot_id = p_id),
    'mine', me = l.seller,
    'sub', (select jsonb_build_object('id', id, 'active', active, 'next_at', next_at) from sauda.subs where buyer = me and lot_id = p_id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ продавцу: лоты ═════════════
-- p: { id?, game, section, title, descr, price, old_price, qty, auto, items_add[], needs_id, id_label,
--      deliver_mins, period_days, attrs{}, city, thumb, images[] }
create or replace function public.sauda_lot_save(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u sauda.users; gm sauda.games; l sauda.lots; lid bigint; n int; cap int;
  t text; d text; pr bigint; op bigint; q int; au boolean; nid boolean; idl text; dm int; pd int; ct text; th text; im jsonb; at jsonb;
  sec text; e jsonb; line text; added int := 0;
begin
  u := sauda.me(p_token);
  lid := nullif(p->>'id', '')::bigint;
  select * into gm from sauda.games where id = p->>'game';
  if not found then raise exception 'bad_game'; end if;
  sec := coalesce(p->>'section', '');
  if not exists (select 1 from jsonb_array_elements(gm.sections) x where x->>'id' = sec) then raise exception 'bad_section'; end if;
  t := regexp_replace(trim(coalesce(p->>'title', '')), '[[:space:]]+', ' ', 'g');
  d := trim(coalesce(p->>'descr', ''));
  pr := (p->>'price')::bigint;
  op := nullif(p->>'old_price', '')::bigint;
  au := coalesce((p->>'auto')::boolean, false);
  q := nullif(p->>'qty', '')::int;
  nid := coalesce((p->>'needs_id')::boolean, false);
  idl := trim(coalesce(p->>'id_label', ''));
  dm := coalesce(nullif(p->>'deliver_mins', '')::int, case when au then 1 else 60 end);
  pd := nullif(p->>'period_days', '')::int;
  ct := trim(coalesce(p->>'city', ''));
  th := coalesce(p->>'thumb', '');
  im := coalesce(p->'images', '[]'::jsonb);
  at := coalesce(p->'attrs', '{}'::jsonb);

  if length(t) < 3 or length(t) > 120 then raise exception 'bad_title'; end if;
  if length(d) > 5000 then raise exception 'too_long'; end if;
  if pr is null or pr < 10 or pr > 10000000 then raise exception 'bad_price'; end if;
  if op is not null and op <= pr then op := null; end if;
  if q is not null and (q < 0 or q > 1000000) then raise exception 'bad_qty'; end if;
  if length(idl) > 40 then raise exception 'too_long'; end if;
  if dm < 1 or dm > 20160 then raise exception 'bad_input'; end if;
  if pd is not null and (pd < 1 or pd > 366) then raise exception 'bad_input'; end if;
  if length(ct) > 40 then raise exception 'too_long'; end if;
  if th <> '' and (th !~ '^data:image/(png|jpeg|webp|gif);base64,' or length(th) > 45000) then raise exception 'bad_image'; end if;
  if jsonb_typeof(im) <> 'array' or jsonb_array_length(im) > 5 then raise exception 'bad_image'; end if;
  for e in select * from jsonb_array_elements(im) loop
    if jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^data:image/(png|jpeg|webp|gif);base64,' or length(e #>> '{}') > 350000 then
      raise exception 'bad_image';
    end if;
  end loop;
  if jsonb_typeof(at) <> 'object' or length(at::text) > 1500 then raise exception 'bad_input'; end if;
  if exists (select 1 from jsonb_each(at) x where jsonb_typeof(x.value) <> 'string' or length(x.key) > 30 or length(x.value #>> '{}') > 60) then
    raise exception 'bad_input';
  end if;

  if lid is null then
    cap := case when u.pro_until > now() then sauda.cfgn('max_lots_pro') else sauda.cfgn('max_lots') end;
    select count(*) into n from sauda.lots where seller = u.id and status in ('active', 'paused', 'sold');
    if n >= cap then raise exception 'too_many_lots'; end if;
    insert into sauda.lots(seller, game, section, title, descr, price, old_price, qty, auto, needs_id, id_label, deliver_mins,
                           period_days, attrs, city, thumb, images, is_demo)
    values (u.id, gm.id, sec, t, d, pr, op, case when au then 0 else q end, au, nid, idl, dm, pd, at, ct, th, im, u.is_demo)
    returning * into l;
  else
    select * into l from sauda.lots where id = lid for update;
    if not found or l.seller <> u.id or l.status = 'deleted' then raise exception 'not_found'; end if;
    if l.status = 'blocked' then raise exception 'lot_blocked'; end if;
    update sauda.lots set game = gm.id, section = sec, title = t, descr = d, price = pr, old_price = op,
           qty = case when au then qty else q end, auto = au, needs_id = nid, id_label = idl, deliver_mins = dm, period_days = pd,
           attrs = at, city = ct, thumb = th, images = im, updated_at = now()
     where id = lid returning * into l;
  end if;

  if jsonb_typeof(p->'items_add') = 'array' then
    if jsonb_array_length(p->'items_add') > 2000 then raise exception 'too_many_items'; end if;
    for line in select trim(x #>> '{}') from jsonb_array_elements(p->'items_add') x loop
      if line <> '' then
        if length(line) > 2000 then raise exception 'too_long'; end if;
        insert into sauda.lot_items(lot_id, payload) values (l.id, line);
        added := added + 1;
      end if;
    end loop;
  end if;
  if l.auto then
    select count(*) into n from sauda.lot_items where lot_id = l.id and order_id is null;
    update sauda.lots set qty = n,
           status = case when n = 0 and status = 'active' then 'sold' when n > 0 and status = 'sold' then 'active' else status end
     where id = l.id;
  else
    update sauda.lots set status = case
             when qty is not null and qty = 0 and status = 'active' then 'sold'
             when (qty is null or qty > 0) and status = 'sold' then 'active' else status end
     where id = l.id;
  end if;
  return jsonb_build_object('ok', true, 'id', l.id, 'added', added);
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
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_lot_items(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if not exists (select 1 from sauda.lots where id = p_id and seller = u.id) then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true, 'items', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'payload', payload) order by id), '[]'::jsonb)
    from (select * from sauda.lot_items where lot_id = p_id and order_id is null order by id limit 2000) i));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_lot_items_del(p_token text, p_id bigint, p_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; n int;
begin
  u := sauda.me(p_token);
  if not exists (select 1 from sauda.lots where id = p_id and seller = u.id and status <> 'deleted') then raise exception 'not_found'; end if;
  delete from sauda.lot_items where lot_id = p_id and order_id is null and id = any(coalesce(p_ids, '{}'));
  select count(*) into n from sauda.lot_items where lot_id = p_id and order_id is null;
  update sauda.lots set qty = n, status = case when n = 0 and status = 'active' then 'sold' else status end
   where id = p_id and auto;
  return jsonb_build_object('ok', true, 'left', n);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_my_lots(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; cd int;
begin
  u := sauda.me(p_token);
  cd := case when u.pro_until > now() then sauda.cfgn('raise_min_pro') else sauda.cfgn('raise_min') end;
  return jsonb_build_object('ok', true,
    'lots', (select coalesce(jsonb_agg(sauda.card(l, u) || jsonb_build_object('views', l.views) order by l.game, l.section, l.raised_at desc), '[]'::jsonb)
             from sauda.lots l where l.seller = u.id and l.status <> 'deleted'),
    'raises', (select coalesce(jsonb_agg(jsonb_build_object('game', r.game, 'section', r.section, 'at', r.at,
                 'next_at', r.at + make_interval(mins => cd))), '[]'::jsonb) from sauda.raises r where r.seller = u.id),
    'cooldown', cd);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- поднять все свои активные лоты раздела наверх списка
create or replace function public.sauda_raise(p_token text, p_game text, p_section text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; cd int; last timestamptz; n int;
begin
  u := sauda.me(p_token);
  cd := case when u.pro_until > now() then sauda.cfgn('raise_min_pro') else sauda.cfgn('raise_min') end;
  select at into last from sauda.raises where seller = u.id and game = p_game and section = p_section;
  if last is not null and last > now() - make_interval(mins => cd) then
    return jsonb_build_object('ok', false, 'error', 'raise_wait', 'next_at', last + make_interval(mins => cd));
  end if;
  update sauda.lots set raised_at = now() where seller = u.id and game = p_game and section = p_section and status = 'active';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nothing_to_raise'; end if;
  insert into sauda.raises(seller, game, section, at) values (u.id, p_game, p_section, now())
  on conflict (seller, game, section) do update set at = now();
  return jsonb_build_object('ok', true, 'raised', n, 'next_at', now() + make_interval(mins => cd));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ покупка и заказы ═════════════
create or replace function public.sauda_buy(p_token text, p_lot bigint, p_qty int default 1, p_data text default '', p_renew boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; oid bigint; sid bigint; pd int;
begin
  u := sauda.me(p_token);
  oid := sauda.place_order(u.id, p_lot, p_qty, p_data);
  select period_days into pd from sauda.lots where id = p_lot;
  if coalesce(p_renew, false) and pd is not null then
    insert into sauda.subs(buyer, lot_id, buyer_data, active, next_at, last_order)
    values (u.id, p_lot, trim(coalesce(p_data, '')), true, now() + make_interval(days => pd), oid)
    on conflict (buyer, lot_id) do update set active = true, buyer_data = excluded.buyer_data, next_at = excluded.next_at,
      last_order = oid, fails = 0
    returning id into sid;
    update sauda.orders set sub_id = sid where id = oid;
  end if;
  return jsonb_build_object('ok', true, 'order', oid, 'balance', (select balance from sauda.users where id = u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_order(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; o sauda.orders;
begin
  perform sauda.maybe_tick();
  u := sauda.me(p_token);
  select * into o from sauda.orders where id = p_id;
  if not found or (u.id not in (o.buyer, o.seller) and u.role not in ('admin', 'moder')) then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true, 'order', sauda.order_json(o, u.id),
    'review', (select sauda.review_json(r) from sauda.reviews r where r.order_id = o.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- p_role: buy | sell; p_status: '' | active | completed | refunded | dispute
create or replace function public.sauda_orders(p_token text, p_role text default 'buy', p_status text default '', p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true,
    'items', (select coalesce(jsonb_agg(sauda.order_json(o, u.id) order by o.id desc), '[]'::jsonb) from (
        select * from sauda.orders o
        where (case when p_role = 'sell' then o.seller else o.buyer end) = u.id
          and (coalesce(p_status, '') = ''
               or (p_status = 'active' and o.status in ('paid', 'delivered', 'dispute'))
               or o.status = p_status)
        order by o.id desc limit 40 offset greatest(coalesce(p_offset, 0), 0)) o),
    'counts', (select jsonb_build_object(
        'all', count(*),
        'active', count(*) filter (where status in ('paid', 'delivered', 'dispute')),
        'completed', count(*) filter (where status = 'completed'),
        'refunded', count(*) filter (where status = 'refunded'),
        'dispute', count(*) filter (where status = 'dispute'))
      from sauda.orders where (case when p_role = 'sell' then seller else buyer end) = u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- действия по заказу: deliver (продавец), confirm (покупатель), refund (продавец), cancel (покупатель, срок вышел),
-- dispute (любой из двух, с причиной), undispute (кто открыл спор)
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
    update sauda.orders set status = 'dispute', dispute_reason = txt, dispute_by = u.id, complete_at = null where id = o.id;
    perform sauda.sys(o.buyer, o.seller, u.id, jsonb_build_object('k', 'dispute_open', 'id', o.id, 'reason', txt,
      'by', case when u.id = o.buyer then 'buyer' else 'seller' end), o.id);
    perform sauda.notify(case when u.id = o.buyer then o.seller else o.buyer end, 'dispute_open', jsonb_build_object('id', o.id, 'title', o.title), '#/order/' || o.id);
    perform sauda.notify_staff('dispute_new', jsonb_build_object('id', o.id, 'title', o.title, 'amount', o.amount), '#/admin/disputes');

  elsif p_action = 'undispute' then
    if o.status <> 'dispute' then raise exception 'bad_status'; end if;
    if o.dispute_by <> u.id then raise exception 'forbidden'; end if;
    update sauda.orders set
      status = case when delivered_at is not null then 'delivered' else 'paid' end,
      complete_at = case when delivered_at is not null then now() + make_interval(hours => sauda.cfgn('complete_hours')::int) end,
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

-- ═════════════ отзывы ═════════════
create or replace function public.sauda_review(p_token text, p_order bigint, p_stars int, p_text text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; o sauda.orders; old smallint; txt text := trim(coalesce(p_text, ''));
begin
  u := sauda.me(p_token);
  select * into o from sauda.orders where id = p_order;
  if not found or o.buyer <> u.id then raise exception 'not_found'; end if;
  if o.status <> 'completed' then raise exception 'bad_status'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_input'; end if;
  if length(txt) > 1000 then raise exception 'too_long'; end if;
  select stars into old from sauda.reviews where order_id = o.id;
  if old is null then
    insert into sauda.reviews(order_id, seller, buyer, lot_id, game, stars, text) values (o.id, o.seller, o.buyer, o.lot_id, o.game, p_stars, txt);
    update sauda.users set stars_sum = stars_sum + p_stars, reviews = reviews + 1 where id = o.seller;
    update sauda.orders set reviewed = true where id = o.id;
    perform sauda.notify(o.seller, 'review_new', jsonb_build_object('id', o.id, 'stars', p_stars, 'title', o.title), '#/order/' || o.id);
  else
    update sauda.reviews set stars = p_stars, text = txt where order_id = o.id;
    update sauda.users set stars_sum = stars_sum - old + p_stars where id = o.seller;
  end if;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_review_reply(p_token text, p_order bigint, p_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; txt text := trim(coalesce(p_text, ''));
begin
  u := sauda.me(p_token);
  if length(txt) > 1000 then raise exception 'too_long'; end if;
  update sauda.reviews set reply = txt, replied_at = now() where order_id = p_order and seller = u.id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_reviews(p_login text, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select id into uid from sauda.users where login = lower(coalesce(p_login, ''));
  if uid is null then return sauda.fail('not_found'); end if;
  return jsonb_build_object('ok', true, 'items', sauda.reviews_of(uid, 20, greatest(coalesce(p_offset, 0), 0)));
end $$;

-- ═════════════ профиль продавца ═════════════
create or replace function public.sauda_user(p_token text, p_login text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; tm boolean := sauda.test_mode();
begin
  select * into u from sauda.users where login = lower(coalesce(p_login, ''));
  if not found or (u.is_demo and not tm) then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true,
    'user', sauda.mini(u) || jsonb_build_object('bio', u.bio, 'city', u.city, 'purchases', u.purchases, 'ban_reason', case when u.banned then u.ban_reason else '' end),
    'lots', (select coalesce(jsonb_agg(sauda.card(l, u) order by l.game, l.section, l.raised_at desc), '[]'::jsonb)
             from sauda.lots l where l.seller = u.id and l.status = 'active' and not u.banned),
    'reviews', sauda.reviews_of(u.id, 10, 0),
    'stars', (select coalesce(jsonb_object_agg(stars, n), '{}'::jsonb) from (select stars, count(*) n from sauda.reviews where seller = u.id group by stars) s),
    'me', sauda.uid(p_token) = u.id);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ переписка ═════════════
create or replace function public.sauda_chats(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'peer', sauda.mini(p), 'last_at', c.last_at, 'last_text', c.last_text, 'last_kind', c.last_kind,
      'last_mine', c.last_sender = u.id, 'unread', case when c.a = u.id then c.unread_a else c.unread_b end) order by c.last_at desc), '[]'::jsonb)
    from (select * from sauda.chats where a = u.id or b = u.id order by last_at desc limit 200) c
    join sauda.users p on p.id = case when c.a = u.id then c.b else c.a end));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- сообщения с собеседником: p_after — только новее (опрос), p_before — страница старше; читает — сбрасывает непрочитанные
create or replace function sauda.chat_read(p_me uuid, p_peer uuid, p_after bigint, p_before bigint, p_mark boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c sauda.chats; pr sauda.users; msgs jsonb;
begin
  select * into pr from sauda.users where id = p_peer;
  if not found then raise exception 'not_found'; end if;
  select * into c from sauda.chats where a = least(p_me, p_peer) and b = greatest(p_me, p_peer);
  if found then
    select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'kind', m.kind, 'body', m.body,
             'order_id', m.order_id, 'created_at', m.created_at, 'mine', m.sender = p_me) order by m.id), '[]'::jsonb)
      into msgs
      from (select * from sauda.messages where chat_id = c.id
              and (p_before is null or id < p_before) and id > coalesce(p_after, 0)
            order by id desc limit case when coalesce(p_after, 0) > 0 then 300 else 60 end) m;
    if p_mark and c.a = p_me then update sauda.chats set unread_a = 0 where id = c.id and unread_a <> 0;
    elsif p_mark then update sauda.chats set unread_b = 0 where id = c.id and unread_b <> 0; end if;
  else
    msgs := '[]'::jsonb;
  end if;
  return jsonb_build_object('ok', true, 'peer', sauda.mini(pr), 'messages', msgs,
    'orders', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'amount', o.amount, 'status', o.status,
                 'role', case when o.buyer = p_me then 'buyer' else 'seller' end) order by o.id desc), '[]'::jsonb)
               from sauda.orders o where o.status in ('paid', 'delivered', 'dispute')
                 and ((o.buyer = p_me and o.seller = p_peer) or (o.buyer = p_peer and o.seller = p_me))));
end $$;

create or replace function sauda.chat_send(p_me uuid, p_peer uuid, p_body text, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me sauda.users; pr sauda.users; c bigint; m bigint; v_body text := coalesce(p_body, '');
begin
  select * into me from sauda.users where id = p_me for update;
  select * into pr from sauda.users where id = p_peer;
  if not found then raise exception 'not_found'; end if;
  if p_me = p_peer then raise exception 'self_chat'; end if;
  if me.role <> 'bot' then
    if me.rate_at > now() - interval '1 minute' then
      if me.rate_n >= 30 then raise exception 'slow_down'; end if;
      update sauda.users set rate_n = rate_n + 1 where id = p_me;
    else
      update sauda.users set rate_at = now(), rate_n = 1 where id = p_me;
    end if;
  end if;
  if p_kind = 'text' then
    v_body := trim(v_body);
    if length(v_body) < 1 then raise exception 'empty'; end if;
    if length(v_body) > 3000 then raise exception 'too_long'; end if;
  elsif p_kind = 'image' then
    if v_body !~ '^data:image/(png|jpeg|webp|gif);base64,' or length(v_body) > 450000 then raise exception 'bad_image'; end if;
  else
    raise exception 'bad_input';
  end if;
  c := sauda.chat_of(p_me, p_peer);
  m := sauda.post(c, p_me, p_kind, v_body);
  -- демо-продавец отвечает сам (не чаще раза в 10 минут)
  if pr.is_demo and not exists (select 1 from sauda.messages where chat_id = c and sender = p_peer and kind = 'system'
                                  and strpos(body, 'demo_reply') > 0 and created_at > now() - interval '10 minutes') then
    perform sauda.post(c, p_peer, 'system', '{"k":"demo_reply"}');
  end if;
  if pr.id = sauda.platform() and me.role not in ('admin', 'moder') then
    perform sauda.notify_staff('support_msg', jsonb_build_object('login', me.login, 'text', left(case when p_kind = 'image' then '📷' else v_body end, 120)), '#/admin/support/' || me.id);
  end if;
  return jsonb_build_object('ok', true, 'id', m);
end $$;

create or replace function public.sauda_chat(p_token text, p_peer uuid, p_after bigint default 0, p_before bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return sauda.chat_read(u.id, p_peer, p_after, p_before);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_send(p_token text, p_peer uuid, p_body text, p_kind text default 'text')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return sauda.chat_send(u.id, p_peer, p_body, p_kind);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ кошелёк ═════════════
create or replace function public.sauda_wallet(p_token text, p_before bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'balance', u.balance, 'test_mode', sauda.test_mode(),
    'hold_in', (select coalesce(sum(amount), 0) from sauda.orders where seller = u.id and status in ('paid', 'delivered', 'dispute')),
    'hold_out', (select coalesce(sum(amount), 0) from sauda.orders where buyer = u.id and status in ('paid', 'delivered', 'dispute')),
    'earned', (select coalesce(sum(amount), 0) from sauda.tx where user_id = u.id and kind in ('sale', 'referral')),
    'spent', (select coalesce(-sum(amount), 0) from sauda.tx where user_id = u.id and kind in ('purchase', 'pro')),
    'tx', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'kind', t.kind, 'ref', t.ref, 'note', t.note,
              'balance_after', t.balance_after, 'created_at', t.created_at) order by t.id desc), '[]'::jsonb)
           from (select * from sauda.tx where user_id = u.id and (p_before is null or id < p_before) order by id desc limit 50) t),
    'withdrawals', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'amount', w.amount, 'fee', w.fee, 'method', w.method,
              'details', '•••• ' || right(w.details, 4), 'status', w.status, 'note', w.note, 'test', w.test,
              'created_at', w.created_at, 'processed_at', w.processed_at) order by w.id desc), '[]'::jsonb)
           from (select * from sauda.withdrawals where user_id = u.id order by id desc limit 20) w));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- пополнение: в тестовом режиме зачисляется сразу; настоящие деньги — через платёжный шлюз (см. market/README.md)
create or replace function public.sauda_topup(p_token text, p_amount bigint, p_method text default 'kaspi')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; tid bigint; today bigint;
begin
  u := sauda.me(p_token);
  if p_method not in ('kaspi', 'halyk', 'card', 'freedom', 'apple', 'google') then raise exception 'bad_input'; end if;
  if p_amount is null or p_amount < 100 or p_amount > sauda.cfgn('max_topup') then raise exception 'bad_amount'; end if;
  if not sauda.test_mode() then raise exception 'payments_soon'; end if;
  select coalesce(sum(amount), 0) into today from sauda.topups where user_id = u.id and created_at > now() - interval '1 day';
  if today + p_amount > 2000000 then raise exception 'limit_day'; end if;
  insert into sauda.topups(user_id, amount, method, status, paid_at) values (u.id, p_amount, p_method, 'paid', now()) returning id into tid;
  return jsonb_build_object('ok', true, 'balance', sauda.money(u.id, p_amount, 'topup', tid, p_method), 'test', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function sauda.luhn(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare s int := 0; d int; i int; n int := length(p);
begin
  for i in 1..n loop
    d := substr(p, n - i + 1, 1)::int;
    if mod(i, 2) = 0 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
  end loop;
  return mod(s, 10) = 0;
end $$;

-- вывод: деньги списываются сразу и ждут, пока администратор переведёт их на Kaspi / карту
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
  if (select count(*) from sauda.withdrawals where user_id = u.id and status = 'pending') >= 3 then raise exception 'too_many_pending'; end if;
  v_fee := ceil(p_amount * sauda.cfgn('withdraw_fee_pct') / 100.0)::bigint;
  insert into sauda.withdrawals(user_id, amount, fee, method, details, test) values (u.id, p_amount, v_fee, p_method, d, sauda.test_mode()) returning id into wid;
  b := sauda.money(u.id, -p_amount, 'withdraw', wid, p_method);
  perform sauda.notify_staff('withdraw_new', jsonb_build_object('id', wid, 'amount', p_amount, 'login', u.login), '#/admin/withdrawals');
  return jsonb_build_object('ok', true, 'id', wid, 'balance', b, 'fee', v_fee);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_promo(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; pr sauda.promos; c text := upper(trim(coalesce(p_code, ''))); b bigint;
begin
  u := sauda.me(p_token);
  select * into pr from sauda.promos where code = c for update;
  if not found or pr.uses_left <= 0 or (pr.expires_at is not null and pr.expires_at < now()) then raise exception 'bad_promo'; end if;
  if exists (select 1 from sauda.promo_uses where code = c and user_id = u.id) then raise exception 'promo_used'; end if;
  insert into sauda.promo_uses(code, user_id) values (c, u.id);
  update sauda.promos set uses_left = uses_left - 1 where code = c;
  b := sauda.money(u.id, pr.amount, 'promo', null, c);
  perform sauda.money(sauda.platform(), -pr.amount, 'promo_out', null, c);
  return jsonb_build_object('ok', true, 'amount', pr.amount, 'balance', b);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- Sauda Pro: меньше комиссия, чаще поднятие, выше в выдаче, значок
create or replace function public.sauda_pro(p_token text, p_months int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; price bigint; until timestamptz;
begin
  u := sauda.me(p_token);
  price := ((select v from sauda.config where k = 'pro_prices') ->> p_months::text)::bigint;
  if price is null then raise exception 'bad_input'; end if;
  perform sauda.money(u.id, -price, 'pro', null, p_months || ' мес.');
  perform sauda.money(sauda.platform(), price, 'pro_in', null, u.login);
  until := greatest(coalesce(u.pro_until, now()), now()) + make_interval(days => 30 * p_months);
  update sauda.users set pro_until = until where id = u.id;
  return jsonb_build_object('ok', true, 'pro_until', until);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ подписки с автопродлением ═════════════
create or replace function public.sauda_subs(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'active', s.active, 'next_at', s.next_at, 'fails', s.fails, 'buyer_data', s.buyer_data, 'last_order', s.last_order,
      'created_at', s.created_at, 'lot', sauda.card(l, su)) order by s.active desc, s.next_at), '[]'::jsonb)
    from sauda.subs s join sauda.lots l on l.id = s.lot_id join sauda.users su on su.id = l.seller where s.buyer = u.id));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_sub_set(p_token text, p_id bigint, p_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  update sauda.subs set active = p_active, fails = 0, next_at = case when p_active then greatest(next_at, now()) else next_at end
   where id = p_id and buyer = u.id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ избранное, уведомления, жалобы ═════════════
create or replace function public.sauda_fav(p_token text, p_lot bigint, p_on boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  if p_on then
    if not exists (select 1 from sauda.lots where id = p_lot) then raise exception 'not_found'; end if;
    insert into sauda.favs(user_id, lot_id) values (u.id, p_lot) on conflict do nothing;
  else
    delete from sauda.favs where user_id = u.id and lot_id = p_lot;
  end if;
  return jsonb_build_object('ok', true);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_favs(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'items', (select coalesce(jsonb_agg(sauda.card(l, s) order by f.created_at desc), '[]'::jsonb)
    from sauda.favs f join sauda.lots l on l.id = f.lot_id join sauda.users s on s.id = l.seller
    where f.user_id = u.id and l.status <> 'deleted'));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_notifs(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users; res jsonb;
begin
  u := sauda.me(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'data', n.data, 'link', n.link, 'read', n.read,
           'created_at', n.created_at) order by n.id desc), '[]'::jsonb) into res
    from (select * from sauda.notifs where user_id = u.id order by id desc limit 60) n;
  update sauda.notifs set read = true where user_id = u.id and not read;
  return jsonb_build_object('ok', true, 'items', res);
exception when raise_exception then return sauda.fail(sqlerrm);
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
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

-- ═════════════ продавцу: статистика, рефералы ═════════════
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
    'fee_pct', case when u.pro_until > now() then sauda.cfgn('pro_fee_pct') else sauda.cfgn('fee_pct') end);
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;

create or replace function public.sauda_ref(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u sauda.users;
begin
  u := sauda.me(p_token);
  return jsonb_build_object('ok', true, 'code', u.ref_code, 'pct', sauda.cfgn('ref_pct'),
    'earned', (select coalesce(sum(amount), 0) from sauda.tx where user_id = u.id and kind = 'referral'),
    'invited', (select coalesce(jsonb_agg(jsonb_build_object('login', login, 'name', name, 'since', created_at, 'sales', sales, 'purchases', purchases)
                 order by created_at desc), '[]'::jsonb) from (select * from sauda.users where ref_by = u.id order by created_at desc limit 100) r));
exception when raise_exception then return sauda.fail(sqlerrm);
end $$;
