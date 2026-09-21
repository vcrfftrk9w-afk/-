import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { UPLOADS, RENDERS, WORK, MAX_ASSETS } from './config.js';
import { probe } from './ffmpeg.js';

/**
 * Хранилище проектов в памяти: сессия = проект = набор ассетов + история планов.
 * Для одного пользователя на своей машине этого достаточно; при переезде
 * на несколько инстансов эту карту надо заменить на БД, а файлы — на объектное
 * хранилище, остальной код от этого не зависит.
 */
const projects = new Map();

const PROJECT_TTL_MS = Number(process.env.PROJECT_TTL_HOURS || 12) * 3600 * 1000;

export function createProject() {
  const id = crypto.randomUUID();
  const project = {
    id,
    createdAt: Date.now(),
    touchedAt: Date.now(),
    assets: new Map(),
    plan: null,
    renders: [],
  };
  projects.set(id, project);
  return project;
}

export function getProject(id) {
  const project = projects.get(String(id || ''));
  if (project) project.touchedAt = Date.now();
  return project || null;
}

export async function addAsset(project, file) {
  if (project.assets.size >= MAX_ASSETS) {
    throw Object.assign(new Error(`В одном проекте не больше ${MAX_ASSETS} файлов.`), { status: 400 });
  }

  let meta;
  try {
    meta = await probe(file.path);
  } catch {
    await fs.unlink(file.path).catch(() => {});
    throw Object.assign(new Error(`Не смог прочитать «${file.originalname}» — формат не распознан.`), { status: 400 });
  }

  if (meta.kind === 'unknown') {
    await fs.unlink(file.path).catch(() => {});
    throw Object.assign(new Error(`В «${file.originalname}» нет ни видео, ни звука.`), { status: 400 });
  }

  const asset = {
    id: crypto.randomUUID(),
    originalName: file.originalname,
    storagePath: file.path,
    mimeType: file.mimetype,
    addedAt: Date.now(),
    ...meta,
  };
  project.assets.set(asset.id, asset);
  return asset;
}

export async function removeAsset(project, assetId) {
  const asset = project.assets.get(assetId);
  if (!asset) return false;
  project.assets.delete(assetId);
  await fs.unlink(asset.storagePath).catch(() => {});
  return true;
}

/** Ассет для отдачи в UI: без путей на диске. */
export function publicAsset(asset) {
  return {
    id: asset.id,
    name: asset.originalName,
    kind: asset.kind,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    hasAudio: asset.hasAudio,
    sizeBytes: asset.sizeBytes,
  };
}

/** Чистит проекты, которые никто не трогал, вместе с их файлами. */
export async function sweepExpired(now = Date.now()) {
  const removed = [];
  for (const [id, project] of projects) {
    if (now - project.touchedAt < PROJECT_TTL_MS) continue;
    projects.delete(id);
    removed.push(id);
    for (const asset of project.assets.values()) {
      await fs.unlink(asset.storagePath).catch(() => {});
    }
    for (const render of project.renders) {
      await fs.unlink(path.join(RENDERS, render.file)).catch(() => {});
    }
    await fs.rm(path.join(WORK, id), { recursive: true, force: true }).catch(() => {});
  }
  return removed;
}

export async function ensureStorage() {
  for (const dir of [UPLOADS, RENDERS, WORK]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export { projects };
