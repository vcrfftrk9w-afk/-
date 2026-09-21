import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import multer from 'multer';

import { PORT, ROOT, UPLOADS, RENDERS, MAX_UPLOAD_BYTES, PRESETS } from './config.js';
import { EFFECTS } from './effects.js';
import { TRANSITIONS, FIT_MODES, normalizePlan } from './plan-schema.js';
import { TEXT_POSITIONS, TEXT_ANIMATIONS } from './ass.js';
import { createPlan, plannerAvailable } from './planner.js';
import {
  addAsset, createProject, ensureStorage, getProject, publicAsset, removeAsset, sweepExpired,
} from './projects.js';
import { cancelJob, createJob, getJob, snapshot, subscribe } from './jobs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS),
    // Имя файла с диска никогда не строится из originalname:
    // иначе «../» в имени увёл бы запись за пределы папки загрузок.
    filename: (_req, file, cb) => {
      const ext = safeExtension(file.originalname);
      cb(null, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 12 },
});

function safeExtension(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function requireProject(req) {
  const project = getProject(req.params.projectId || req.body?.projectId || req.query.projectId);
  if (!project) throw Object.assign(new Error('Проект не найден или устарел. Обновите страницу.'), { status: 404 });
  return project;
}

/* --------------------------------- справка -------------------------------- */

app.get('/api/capabilities', (_req, res) => {
  res.json({
    planner: plannerAvailable() ? 'model' : 'heuristic',
    presets: Object.entries(PRESETS).map(([id, p]) => ({ id, ...p })),
    effects: Object.entries(EFFECTS).map(([id, e]) => ({ id, label: e.label })),
    transitions: TRANSITIONS,
    fitModes: FIT_MODES,
    textPositions: TEXT_POSITIONS,
    textAnimations: TEXT_ANIMATIONS,
    maxUploadBytes: MAX_UPLOAD_BYTES,
  });
});

/* --------------------------------- проекты -------------------------------- */

app.post('/api/projects', (_req, res) => {
  const project = createProject();
  res.json({ projectId: project.id, assets: [] });
});

app.get('/api/projects/:projectId', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  res.json({
    projectId: project.id,
    assets: [...project.assets.values()].map(publicAsset),
    plan: project.plan,
    renders: project.renders.map((r) => ({ ...r, url: `/api/renders/${r.file}` })),
  });
}));

app.post('/api/projects/:projectId/assets', upload.array('files', 12), asyncRoute(async (req, res) => {
  const project = requireProject(req);
  const added = [];
  const failed = [];
  for (const file of req.files || []) {
    try {
      added.push(publicAsset(await addAsset(project, file)));
    } catch (error) {
      failed.push({ name: file.originalname, reason: error.message });
    }
  }
  res.json({ assets: [...project.assets.values()].map(publicAsset), added, failed });
}));

app.delete('/api/projects/:projectId/assets/:assetId', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  const removed = await removeAsset(project, req.params.assetId);
  if (!removed) return res.status(404).json({ error: 'Файл не найден.' });
  res.json({ assets: [...project.assets.values()].map(publicAsset) });
}));

/** Превью исходника прямо из браузера — чтобы пользователь видел, что загрузил. */
app.get('/api/projects/:projectId/assets/:assetId/raw', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  const asset = project.assets.get(req.params.assetId);
  if (!asset) return res.status(404).end();
  res.sendFile(asset.storagePath);
}));

/* ------------------------------- планирование ------------------------------ */

app.post('/api/projects/:projectId/plan', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  if (!project.assets.size) {
    return res.status(400).json({ error: 'Сначала загрузите видео или фото.' });
  }

  const prompt = String(req.body?.prompt || '').slice(0, 4000);
  if (!prompt.trim()) return res.status(400).json({ error: 'Опишите, какой монтаж нужен.' });

  const { plan: raw, source, error } = await createPlan({
    prompt,
    assets: project.assets,
    preset: req.body?.preset,
    previousPlan: req.body?.refine ? project.plan : null,
  });

  const { plan, warnings } = normalizePlan(raw, project.assets);
  project.plan = plan;

  res.json({
    plan,
    warnings,
    source,
    plannerError: error || null,
    estimatedDuration: estimateDuration(plan),
  });
}));

/** Ручная правка плана из UI: тот же нормализатор, та же защита. */
app.put('/api/projects/:projectId/plan', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  const { plan, warnings } = normalizePlan(req.body?.plan, project.assets);
  project.plan = plan;
  res.json({ plan, warnings, estimatedDuration: estimateDuration(plan) });
}));

/* --------------------------------- рендер --------------------------------- */

app.post('/api/projects/:projectId/render', asyncRoute(async (req, res) => {
  const project = requireProject(req);
  const source = req.body?.plan ? normalizePlan(req.body.plan, project.assets).plan : project.plan;
  if (!source) return res.status(400).json({ error: 'Сначала соберите план монтажа.' });
  if (!source.clips.length) return res.status(400).json({ error: 'В плане нет клипов.' });

  project.plan = source;
  const job = createJob({ project, plan: source });
  res.json(snapshot(job));
}));

app.get('/api/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Задача не найдена.' });
  res.json(snapshot(job));
});

app.post('/api/jobs/:jobId/cancel', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Задача не найдена.' });
  res.json({ canceled: cancelJob(job), ...snapshot(job) });
});

/** Живой прогресс через SSE: опрос раз в секунду здесь был бы заметно грубее. */
app.get('/api/jobs/:jobId/events', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const listener = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  listener.close = () => res.end();
  const unsubscribe = subscribe(job, listener);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(keepAlive); unsubscribe(); });
});

app.get('/api/renders/:file', (req, res) => {
  // Имя рендера — это UUID задачи; всё остальное отвергаем, не трогая диск.
  if (!/^[0-9a-f-]{36}\.mp4$/i.test(req.params.file)) return res.status(400).end();
  res.sendFile(path.join(RENDERS, req.params.file), (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});

/* -------------------------------- служебное -------------------------------- */

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ.` });
  }
  const status = error?.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error?.message || 'Внутренняя ошибка.' });
});

function estimateDuration(plan) {
  const raw = plan.clips.reduce((sum, c) => sum + c.duration, 0);
  const overlap = plan.clips.slice(1).reduce(
    (sum, c) => sum + (c.transition.type === 'cut' ? 0 : c.transition.duration), 0,
  );
  return Math.round((raw - overlap) * 100) / 100;
}

export { app };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here, 'index.js')) {
  await ensureStorage();
  setInterval(() => { sweepExpired().catch(() => {}); }, 30 * 60 * 1000).unref();
  app.listen(PORT, () => {
    console.log(`AI-видеоредактор: http://localhost:${PORT}`);
    console.log(`Планировщик: ${plannerAvailable() ? 'Claude' : 'локальный парсер (задайте ANTHROPIC_API_KEY для умного режима)'}`);
  });
}
