/**
 * Нормализация монтажного плана.
 *
 * План приходит либо от модели, либо от локального парсера, либо прямо из UI —
 * и в любом случае попадает в аргументы ffmpeg. Поэтому здесь всё приводится
 * к безопасным типам и диапазонам: строки только из белых списков, числа зажаты,
 * ссылки на ассеты проверены. Всё, что не прошло, не роняет рендер, а
 * откатывается к разумному значению и попадает в `warnings`.
 */

import { EFFECTS } from './effects.js';
import { TEXT_POSITIONS, TEXT_ANIMATIONS } from './ass.js';
import { PRESETS, DEFAULT_PRESET } from './config.js';

export const TRANSITIONS = [
  'cut', 'fade', 'fadeblack', 'fadewhite', 'dissolve',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'circleopen', 'circleclose', 'circlecrop', 'rectcrop',
  'radial', 'pixelize', 'hblur', 'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'zoomin', 'diagtl', 'diagbr',
];

export const FIT_MODES = ['cover', 'contain', 'blur-pad'];

const MIN_CLIP = 0.25;
const MAX_CLIP = 600;
const MAX_CLIPS = 120;
const MAX_TOTAL = 60 * 20;

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? String(value) : fallback;

const hexColor = (value, fallback) =>
  /^#?[0-9a-f]{6}$/i.test(String(value || '').trim())
    ? `#${String(value).trim().replace(/^#/, '')}`
    : fallback;

/**
 * @param {object} raw — сырой план
 * @param {Map<string, object>} assets — id -> {id, kind, duration, ...}
 * @returns {{plan: object, warnings: string[]}}
 */
export function normalizePlan(raw, assets) {
  const warnings = [];
  const input = raw && typeof raw === 'object' ? raw : {};

  const presetId = pick(input.output?.preset, Object.keys(PRESETS), DEFAULT_PRESET);
  const preset = PRESETS[presetId];
  const output = {
    preset: presetId,
    width: even(clamp(input.output?.width, 128, 3840, preset.width)),
    height: even(clamp(input.output?.height, 128, 3840, preset.height)),
    fps: Math.round(clamp(input.output?.fps, 12, 60, preset.fps)),
    fit: pick(input.output?.fit, FIT_MODES, 'cover'),
  };

  const visual = [...assets.values()].filter((a) => a.kind === 'image' || a.kind === 'video');
  const rawClips = Array.isArray(input.clips) ? input.clips.slice(0, MAX_CLIPS) : [];

  const clips = [];
  for (const [index, rawClip] of rawClips.entries()) {
    const asset = resolveAsset(rawClip?.assetId, assets, visual);
    if (!asset) {
      warnings.push(`Клип ${index + 1}: не нашёл исходник «${rawClip?.assetId}», клип пропущен.`);
      continue;
    }
    clips.push(normalizeClip(rawClip, asset, output, warnings, clips.length));
  }

  if (!clips.length) {
    for (const asset of visual) {
      clips.push(normalizeClip({ assetId: asset.id }, asset, output, warnings, clips.length));
    }
    if (rawClips.length) warnings.push('План не содержал пригодных клипов — собрал ролик из всех загруженных файлов подряд.');
  }

  // Первый клип ни с чем не склеивается, переход на нём не имеет смысла.
  if (clips.length) clips[0].transition = { type: 'cut', duration: 0 };

  trimToBudget(clips, warnings);

  const plan = {
    title: String(input.title || 'Монтаж').slice(0, 120),
    output,
    clips,
    music: normalizeMusic(input.music, assets, warnings),
    audio: {
      keepOriginal: input.audio?.keepOriginal !== false,
      originalVolume: clamp(input.audio?.originalVolume, 0, 2, 1),
    },
    notes: String(input.notes || '').slice(0, 2000),
  };

  return { plan, warnings };
}

function normalizeClip(rawClip, asset, output, warnings, position) {
  const isImage = asset.kind === 'image';
  const sourceDuration = isImage ? Infinity : (asset.duration || 0);

  let start = clamp(rawClip?.start, 0, isImage ? 0 : Math.max(0, sourceDuration - MIN_CLIP), 0);
  let end;
  if (isImage) {
    end = start + clamp(rawClip?.duration ?? rawClip?.end, MIN_CLIP, 30, 3);
  } else {
    const fallbackEnd = sourceDuration > 0 ? sourceDuration : MIN_CLIP;
    end = clamp(rawClip?.end ?? (rawClip?.duration ? start + Number(rawClip.duration) : fallbackEnd), start + MIN_CLIP, Math.max(start + MIN_CLIP, sourceDuration || MAX_CLIP), fallbackEnd);
    if (end - start > MAX_CLIP) end = start + MAX_CLIP;
  }

  const speed = clamp(rawClip?.speed, 0.25, 8, 1);
  const transitionType = pick(rawClip?.transition?.type, TRANSITIONS, position === 0 ? 'cut' : 'cut');
  const rawTransitionDuration = clamp(rawClip?.transition?.duration, 0.1, 3, 0.5);
  const clipDuration = (end - start) / speed;

  const effects = [];
  for (const effect of asArray(rawClip?.effects)) {
    const type = typeof effect === 'string' ? effect : effect?.type;
    if (!EFFECTS[type]) {
      if (type) warnings.push(`Эффект «${type}» неизвестен и пропущен.`);
      continue;
    }
    if (effects.length >= 6) {
      warnings.push('На один клип беру максимум 6 эффектов — лишние отброшены.');
      break;
    }
    effects.push({ type, intensity: clamp(effect?.intensity, 0, 1, 0.5) });
  }

  return {
    assetId: asset.id,
    kind: asset.kind,
    start: round(start),
    end: round(end),
    duration: round(clipDuration),
    speed: round(speed),
    volume: clamp(rawClip?.volume, 0, 2, 1),
    effects,
    text: asArray(rawClip?.text).slice(0, 8).map((t) => normalizeText(t, output, clipDuration)),
    transition: {
      type: transitionType,
      // Переход не может быть длиннее самого клипа, иначе xfade съест его целиком.
      duration: transitionType === 'cut' ? 0 : round(Math.min(rawTransitionDuration, Math.max(0.1, clipDuration * 0.5))),
    },
  };
}

function normalizeText(raw, output, clipDuration) {
  const text = String(raw?.text ?? raw ?? '').slice(0, 300);
  const start = clamp(raw?.start, 0, Math.max(0, clipDuration), 0);
  const end = clamp(raw?.end, start + 0.2, Math.max(start + 0.2, clipDuration), Math.min(clipDuration, start + 2.5));
  return {
    text,
    start: round(start),
    end: round(end),
    position: pick(raw?.position, TEXT_POSITIONS, 'bottom'),
    size: Math.round(clamp(raw?.size, 12, Math.round(output.height / 4), Math.round(output.height * 0.045))),
    color: hexColor(raw?.color, '#FFFFFF'),
    outlineColor: hexColor(raw?.outlineColor, '#000000'),
    bold: raw?.bold !== false,
    animation: pick(raw?.animation, TEXT_ANIMATIONS, 'fade'),
  };
}

function normalizeMusic(raw, assets, warnings) {
  if (!raw || !raw.assetId) return null;
  const asset = assets.get(String(raw.assetId));
  if (!asset) {
    warnings.push(`Музыкальный трек «${raw.assetId}» не найден — собрал без музыки.`);
    return null;
  }
  if (asset.kind !== 'audio' && !asset.hasAudio) {
    warnings.push(`В файле «${asset.originalName}» нет звуковой дорожки — музыку пропустил.`);
    return null;
  }
  return {
    assetId: asset.id,
    volume: clamp(raw.volume, 0, 2, 0.6),
    startAt: clamp(raw.startAt, 0, 3600, 0),
    fadeIn: clamp(raw.fadeIn, 0, 10, 0.5),
    fadeOut: clamp(raw.fadeOut, 0, 10, 1),
    duckOriginal: raw.duckOriginal === true,
  };
}

/** Модель иногда возвращает индекс, имя файла или «1» вместо id — принимаем всё это. */
function resolveAsset(reference, assets, visual) {
  if (reference == null) return visual[0] || null;
  const key = String(reference).trim();
  if (assets.has(key)) return assets.get(key);

  const byName = [...assets.values()].find(
    (a) => a.originalName === key || a.originalName?.toLowerCase() === key.toLowerCase(),
  );
  if (byName) return byName;

  const asIndex = Number(key);
  if (Number.isInteger(asIndex)) {
    if (visual[asIndex]) return visual[asIndex];
    if (visual[asIndex - 1]) return visual[asIndex - 1];
  }
  return null;
}

/** Общая длительность ограничена, иначе одна опечатка модели уводит рендер в часы. */
function trimToBudget(clips, warnings) {
  let total = 0;
  for (const [index, clip] of clips.entries()) {
    total += clip.duration;
    if (total > MAX_TOTAL) {
      const removed = clips.length - index;
      clips.length = index;
      warnings.push(`Ролик длиннее ${MAX_TOTAL / 60} минут — отрезал последние ${removed} клип(ов).`);
      break;
    }
  }
}

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const round = (v) => Math.round(Number(v) * 1000) / 1000;
const even = (v) => Math.round(v / 2) * 2;

export { MIN_CLIP, MAX_TOTAL };
