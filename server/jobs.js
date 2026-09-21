import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { RENDERS, WORK } from './config.js';
import { renderPlan } from './renderer.js';

/**
 * Очередь рендеров. Рендер тяжёлый, поэтому одновременно крутится один —
 * иначе несколько ffmpeg просто отнимают друг у друга процессор и всё
 * становится медленнее. Остальные ждут в очереди, прогресс отдаётся подписчикам.
 */

const jobs = new Map();
const queue = [];
let running = false;

const MAX_JOB_HISTORY = 50;

export function createJob({ project, plan }) {
  const job = {
    id: crypto.randomUUID(),
    projectId: project.id,
    status: 'queued',
    stage: 'В очереди',
    progress: 0,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    error: null,
    file: null,
    plan,
    subscribers: new Set(),
    abort: new AbortController(),
  };
  jobs.set(job.id, job);
  trimHistory();
  queue.push({ job, project });
  queueTick();
  return job;
}

export function getJob(id) {
  return jobs.get(String(id || '')) || null;
}

export function cancelJob(job) {
  if (job.status === 'done' || job.status === 'failed' || job.status === 'canceled') return false;
  job.abort.abort();
  const queued = queue.findIndex((entry) => entry.job.id === job.id);
  if (queued >= 0) queue.splice(queued, 1);
  finish(job, { status: 'canceled', stage: 'Отменено' });
  return true;
}

export function subscribe(job, listener) {
  job.subscribers.add(listener);
  listener(snapshot(job));
  return () => job.subscribers.delete(listener);
}

export function snapshot(job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: Math.round(job.progress * 1000) / 1000,
    error: job.error,
    file: job.file,
    url: job.file ? `/api/renders/${job.file}` : null,
    queuePosition: queue.findIndex((entry) => entry.job.id === job.id) + 1 || null,
  };
}

function emit(job) {
  const payload = snapshot(job);
  for (const listener of job.subscribers) {
    try { listener(payload); } catch { /* подписчик отвалился — не наша забота */ }
  }
}

function finish(job, { status, stage, error = null, file = null }) {
  job.status = status;
  job.stage = stage;
  job.error = error;
  job.file = file;
  job.finishedAt = Date.now();
  if (status === 'done') job.progress = 1;
  emit(job);
  for (const listener of job.subscribers) {
    if (listener.close) listener.close();
  }
}

async function queueTick() {
  if (running) return;
  const entry = queue.shift();
  if (!entry) return;

  running = true;
  const { job, project } = entry;

  try {
    if (job.abort.signal.aborted) throw Object.assign(new Error('Отменено'), { canceled: true });

    job.status = 'running';
    job.startedAt = Date.now();
    job.stage = 'Готовлю материал';
    emit(job);

    const jobDir = path.join(WORK, project.id, job.id);
    const file = `${job.id}.mp4`;
    const outputPath = path.join(RENDERS, file);
    await fs.mkdir(RENDERS, { recursive: true });

    await renderPlan(job.plan, project.assets, {
      jobDir,
      outputPath,
      signal: job.abort.signal,
      onProgress: ({ stage, progress }) => {
        job.stage = stage;
        job.progress = progress;
        emit(job);
      },
    });

    // Промежуточные файлы весят больше готового ролика — держать их незачем.
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});

    project.renders.unshift({ jobId: job.id, file, createdAt: Date.now(), title: job.plan.title });
    project.renders = project.renders.slice(0, 20);

    finish(job, { status: 'done', stage: 'Готово', file });
  } catch (error) {
    const canceled = error?.canceled || job.abort.signal.aborted || error?.name === 'AbortError';
    finish(job, {
      status: canceled ? 'canceled' : 'failed',
      stage: canceled ? 'Отменено' : 'Ошибка',
      error: canceled ? null : humanError(error),
    });
  } finally {
    running = false;
    queueTick();
  }
}

/** ffmpeg сообщает об ошибках многословно — показываем последнюю осмысленную строку. */
function humanError(error) {
  if (error?.name !== 'FfmpegError') return error?.message || String(error);
  const lines = String(error.stderr || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const meaningful = [...lines].reverse().find(
    (line) => /error|invalid|failed|no such|unable|cannot/i.test(line) && !/^frame=/.test(line),
  );
  return meaningful ? `ffmpeg: ${meaningful}` : error.message;
}

function trimHistory() {
  if (jobs.size <= MAX_JOB_HISTORY) return;
  const sorted = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const job of sorted.slice(0, jobs.size - MAX_JOB_HISTORY)) {
    if (job.status === 'running' || job.status === 'queued') continue;
    jobs.delete(job.id);
  }
}

export { jobs };
