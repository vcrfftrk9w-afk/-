// ldm-push — отправляет пуши из очереди ldm.push_outbox на айфоны (и в браузеры) аккаунтов.
// Зовёт её база: ldm.push_tick() раз в минуту (только когда наступил будильник) и «Проверить» в приложении.
// Пароль между базой и функцией — заголовок x-push-token (ldm.push_cfg.cron_token).
// Ключи VAPID функция создаёт сама при первом запуске и хранит в ldm.push_cfg — они не покидают сервер.
import postgres from 'npm:postgres@3.4.5';
import { importVapid, makeVapidKeys, send } from './webpush.mjs';

const SUBJECT = 'https://vcrfftrk9w-afk.github.io/-/'; // контакт отправителя для Apple/Google: адрес приложения
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10 });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function same(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

let vapid: { pub: string; key: CryptoKey } | null = null;

async function keys() {
  if (vapid) return vapid;
  let [c] = await sql`select vapid_pub, vapid_jwk from ldm.push_cfg where id = 1`;
  if (!c.vapid_jwk) {
    const k = await makeVapidKeys();
    await sql`update ldm.push_cfg set vapid_pub = ${k.pub}, vapid_jwk = ${sql.json(k.jwk)} where id = 1 and vapid_jwk is null`;
    [c] = await sql`select vapid_pub, vapid_jwk from ldm.push_cfg where id = 1`;
  }
  vapid = { pub: c.vapid_pub, key: await importVapid(c.vapid_jwk) };
  return vapid;
}

type Job = { id: number; account_id: string; payload: Record<string, unknown>; tries: number };
type Sub = { endpoint: string; account_id: string; p256dh: string; auth: string };

async function deliver() {
  const k = await keys();
  // забираем очередь (две функции одновременно не возьмут одно и то же)
  const jobs = await sql<Job[]>`
    update ldm.push_outbox o set sent_at = now(), tries = o.tries + 1
     where o.id in (select id from ldm.push_outbox
                     where sent_at is null and tries < 3 and created_at > now() - interval '1 hour'
                     order by id limit 50 for update skip locked)
    returning o.id, o.account_id, o.payload, o.tries`;
  let sent = 0;
  const dead = new Set<string>();
  const fine = new Set<string>();
  if (jobs.length) {
    const subs = await sql<Sub[]>`
      select endpoint, account_id, p256dh, auth from ldm.push_subs
       where account_id in ${sql([...new Set(jobs.map((j) => j.account_id))])}`;
    for (const j of jobs) {
      const mine = subs.filter((s) => s.account_id === j.account_id);
      const res = await Promise.all(mine.map((s) =>
        send(s, j.payload, { key: k.key, pub: k.pub, subject: SUBJECT })
          .catch((e: Error) => ({ status: 0, text: String((e && e.message) || e).slice(0, 200) }))));
      res.forEach((r, i) => {
        if (r.status >= 200 && r.status < 300) { fine.add(mine[i].endpoint); sent += 1; }
        else if (r.status === 404 || r.status === 410) dead.add(mine[i].endpoint); // подписки больше нет
      });
      const ok = res.some((r) => r.status >= 200 && r.status < 300);
      // ни одно устройство не получило из-за сбоя сети или службы — попробуем через минуту (до 3 раз)
      const retry = !ok && j.tries < 3 && res.some((r) => r.status === 0 || r.status === 429 || r.status >= 500);
      const result = mine.length
        ? res.map((r, i) => `${new URL(mine[i].endpoint).host} ${r.status}${r.text ? ' ' + r.text : ''}`).join('; ').slice(0, 900)
        : 'no devices';
      await sql`update ldm.push_outbox set result = ${result}, sent_at = ${retry ? null : sql`sent_at`} where id = ${j.id}`;
      if (!ok) console.warn('ldm-push', j.id, result);
    }
  }
  if (dead.size) await sql`delete from ldm.push_subs where endpoint in ${sql([...dead])}`;
  if (fine.size) await sql`update ldm.push_subs set last_ok = now() where endpoint in ${sql([...fine])}`;
  await tidy();
  return { ok: true, jobs: jobs.length, sent, dead: dead.size };
}

/* уборка (и раз в сутки, когда пушей нет): отправленное хранится 3 дня — видно, что и когда ушло;
   журнал запусков расписания ldm-push-tick — 2 дня (иначе +1440 строк в день, база бесплатная) */
async function tidy() {
  await sql`delete from ldm.push_outbox where created_at < now() - interval '3 days'`;
  await sql`delete from ldm.push_sent where day < current_date - 3`;
  try {
    await sql`delete from cron.job_run_details
               where jobid in (select jobid from cron.job where jobname = 'ldm-push-tick')
                 and end_time < now() - interval '2 days'`;
  } catch (e) {
    console.warn('ldm-push: журнал расписания не почищен', e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  try {
    const [cfg] = await sql`select cron_token from ldm.push_cfg where id = 1`;
    if (!cfg || !same(req.headers.get('x-push-token') || '', cfg.cron_token)) return json({ ok: false, error: 'forbidden' }, 403);
    const body = await req.json().catch(() => ({}));
    if (body && body.init) return json({ ok: true, key: (await keys()).pub });
    return json(await deliver());
  } catch (e) {
    console.error('ldm-push', e);
    return json({ ok: false, error: 'internal' }, 500);
  }
});
