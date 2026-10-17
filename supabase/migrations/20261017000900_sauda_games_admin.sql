-- «Sauda»: администратор сам добавляет игры и меняет логотипы.
-- Логотип хранится в базе картинкой (data:image/…, до ~30 КБ — сайт сжимает его до 128×128) и важнее файла из img/games.

alter table sauda.games add column if not exists logo text not null default '';

create or replace function public.sauda_meta()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tm boolean := sauda.test_mode();
begin
  return jsonb_build_object('ok', true,
    'games', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'kind', g.kind, 'emoji', g.emoji, 'color', g.color, 'popular', g.popular, 'sections', g.sections,
        'logo', g.logo,
        'counts', coalesce((select jsonb_object_agg(x.section, x.n) from (
            select l.section, count(*) n from sauda.lots l
            where l.game = g.id and l.status = 'active' and (tm or not l.is_demo) group by l.section) x), '{}'::jsonb))
      order by g.sort, g.name), '[]'::jsonb) from sauda.games g),
    'config', (select jsonb_object_agg(k, v) from sauda.config where k <> 'admin_code'));
end $$;

-- p_action: list | save | delete. save: { id, name, kind, emoji, color, sort, popular, sections: 'accounts|currency:Голда:Голда|…', logo }
-- поля, которых нет в p, у существующей игры не меняются; logo = '' — убрать логотип
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
        if s->>'id' not in ('accounts', 'currency', 'donate', 'items', 'boost', 'keys', 'topup', 'subs', 'services', 'coaching', 'goods', 'other')
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
  when data_exception then return sauda.fail('bad_input');
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
