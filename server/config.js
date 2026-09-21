import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');
export const STORAGE = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(ROOT, 'storage');

export const UPLOADS = path.join(STORAGE, 'uploads');
export const RENDERS = path.join(STORAGE, 'renders');
export const WORK = path.join(STORAGE, 'work');

export const PORT = Number(process.env.PORT || 3000);

/** Максимальный размер одного загружаемого файла. */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 512) * 1024 * 1024;

/** Сколько ассетов разрешено держать в одном проекте. */
export const MAX_ASSETS = Number(process.env.MAX_ASSETS || 40);

/** Модель-планировщик. Без ключа редактор работает на локальном парсере. */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const PLANNER_MODEL = process.env.PLANNER_MODEL || 'claude-opus-5';

/** Пресеты кадра для вертикальных/горизонтальных площадок. */
export const PRESETS = {
  reels:   { width: 1080, height: 1920, fps: 30, label: 'Вертикаль 9:16 (Reels/Shorts/TikTok)' },
  youtube: { width: 1920, height: 1080, fps: 30, label: 'Горизонт 16:9 (YouTube)' },
  square:  { width: 1080, height: 1080, fps: 30, label: 'Квадрат 1:1 (лента)' },
  classic: { width: 1440, height: 1080, fps: 30, label: 'Классика 4:3' },
};

export const DEFAULT_PRESET = 'reels';
