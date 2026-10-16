-- Громкий будильник на айфоне через бесплатное приложение Bark (App Store): звонит даже в беззвучном режиме.
-- Ключ Bark хранится как подписка с адресом https://api.day.app/<ключ> и device = 'bark';
-- отключённые — device = 'bark-off' (их убирает функция ldm-push). Применено как миграция ldm_push_bark.
create function public.ldm_push_bark(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid := ldm.account_of(p_token); k text := nullif(trim(coalesce(p_key, '')), ''); ep text;
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if k is not null and k !~ '^[A-Za-z0-9]{8,64}$' then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  ep := 'https://api.day.app/' || k;
  -- у аккаунта один ключ Bark: прежние выключаются
  update ldm.push_subs set device = 'bark-off'
   where account_id = a and device = 'bark' and (k is null or endpoint <> ep);
  if k is null then return jsonb_build_object('ok', true, 'bark', false); end if;
  if (select count(*) from ldm.push_subs where account_id = a and device <> 'bark-off' and endpoint <> ep) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many_devices');
  end if;
  insert into ldm.push_subs(endpoint, account_id, p256dh, auth, device)
  values (ep, a, '', '', 'bark')
  on conflict (endpoint) do update
    set account_id = excluded.account_id, p256dh = '', auth = '', device = 'bark', created_at = now();
  return jsonb_build_object('ok', true, 'bark', true);
end $$;

-- что сервер знает об уведомлениях аккаунта: Bark, сколько устройств с уведомлениями сайта, последняя отправка
create function public.ldm_push_status(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid := ldm.account_of(p_token); nb int; nw int; last_res text; last_at timestamptz;
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select count(*) filter (where device = 'bark'), count(*) filter (where device not in ('bark', 'bark-off'))
    into nb, nw from ldm.push_subs where account_id = a;
  select result, coalesce(sent_at, created_at) into last_res, last_at
    from ldm.push_outbox where account_id = a order by id desc limit 1;
  return jsonb_build_object('ok', true, 'bark', nb > 0, 'web', nw, 'last', last_res, 'last_at', last_at);
end $$;

revoke all on function public.ldm_push_bark(text, text) from public;
revoke all on function public.ldm_push_status(text) from public;
grant execute on function public.ldm_push_bark(text, text) to anon, authenticated;
grant execute on function public.ldm_push_status(text) to anon, authenticated;

-- там же: ldm_push_test, ldm_push_subscribe и ldm.push_tick больше не считают выключенный Bark ('bark-off')
-- устройством, а проверочный сигнал называется «🔔 Будильник на айфоне работает» (см. 20261016_ldm_push.sql).
