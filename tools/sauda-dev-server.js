// Локальная проверка маркетплейса Sauda без Supabase: раздаёт файлы репозитория и отвечает на
// POST /rest/v1/rpc/sauda_* так же, как PostgREST, — вызывает функции в локальной базе Postgres от роли anon.
//
//   node tools/sauda-dev-server.js [порт] [строка подключения]
//   по умолчанию: 8793 и postgres://postgres@/sauda?host=/var/tmp/saudapg&port=54329
//
// Приложение (market/) само ходит в Supabase; здесь файл market/js/config.js подменяется,
// чтобы оно ходило в этот сервер. Нужен пакет pg (npm i pg) — путь к нему можно дать через NODE_PATH.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = +process.argv[2] || 8793;
const DB = process.argv[3] || 'postgres://postgres@/sauda?host=/var/tmp/saudapg&port=54329';
const ROOT = path.join(__dirname, '..');
const pool = new Pool({ connectionString: DB, max: 8 });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

let sigs = null; // имя функции → [{ name, type }]
async function signatures() {
  if (sigs) return sigs;
  const r = await pool.query(`select p.proname, p.proargnames, array(select format_type(t, null) from unnest(p.proargtypes) t) types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'sauda\\_%'`);
  sigs = {};
  r.rows.forEach((row) => { sigs[row.proname] = (row.proargnames || []).map((name, i) => ({ name, type: row.types[i] })); });
  return sigs;
}

function arg(v, type) {
  if (v === null || v === undefined) return null;
  if (type === 'jsonb' || type === 'json') return JSON.stringify(v);
  if (type.endsWith('[]')) return '{' + (Array.isArray(v) ? v : [v]).map((x) => JSON.stringify(String(x))).join(',') + '}';
  return String(v);
}

async function rpc(fn, body) {
  const all = await signatures();
  const params = all[fn];
  if (!params) return [404, { code: 'PGRST202', message: 'Could not find the function public.' + fn }];
  const names = Object.keys(body || {});
  const unknown = names.filter((n) => !params.some((p) => p.name === n));
  if (unknown.length) return [404, { code: 'PGRST202', message: 'unknown args ' + unknown.join(',') }];
  const used = params.filter((p) => names.includes(p.name));
  const sql = `select public.${fn}(${used.map((p, i) => `${p.name} => $${i + 1}::${p.type}`).join(', ')}) as r`;
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role anon');
    const r = await c.query(sql, used.map((p) => arg(body[p.name], p.type)));
    await c.query('commit');
    return [200, r.rows[0].r];
  } catch (e) {
    await c.query('rollback').catch(() => {});
    return [400, { code: e.code, message: e.message }];
  } finally {
    c.release();
  }
}

const CONFIG = (base) => `'use strict';
const Cfg = { api: '${base}/rest/v1/rpc/', key: 'local-dev', local: true };
`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'apikey, content-type, authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    let raw = '';
    req.on('data', (d) => { raw += d; });
    req.on('end', async () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (e) { res.writeHead(400); return res.end('{"message":"bad json"}'); }
      const [code, out] = await rpc(url.pathname.slice('/rest/v1/rpc/'.length), body);
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  if (url.pathname === '/market/js/config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end(CONFIG(`http://${req.headers.host}`));
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Sauda: http://localhost:${PORT}/market/  (база: ${DB})`));
