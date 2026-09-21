/**
 * Локальный разбор промпта — запасной планировщик.
 *
 * Работает без ключа к модели и без сети: ищет в тексте знакомые слова
 * (эффекты, темп, формат кадра, длительность, подписи в кавычках) и собирает
 * из этого честный монтажный план. Он проще модельного, но предсказуем,
 * поэтому же используется как страховка, если модель недоступна.
 */

import { EFFECTS } from './effects.js';
import { PRESETS, DEFAULT_PRESET } from './config.js';

const PRESET_HINTS = [
  { preset: 'reels', words: ['вертикал', 'reels', 'рилс', 'тикток', 'tiktok', 'shorts', 'шортс', 'сторис', 'stories', '9:16'] },
  { preset: 'youtube', words: ['горизонт', 'ютуб', 'youtube', '16:9', 'широкоэкран', 'landscape'] },
  { preset: 'square', words: ['квадрат', 'square', '1:1', 'лент'] },
  { preset: 'classic', words: ['4:3', 'классик'] },
];

const FAST_WORDS = ['динамич', 'быстр', 'энергич', 'под бит', 'по биту', 'ритм', 'клипов', 'нарез', 'dynamic', 'fast', 'upbeat', 'бодр', 'драйв'];
const SLOW_WORDS = ['медлен', 'спокой', 'плавн', 'лирич', 'атмосферн', 'slow', 'calm', 'chill', 'размерен'];

const TRANSITION_HINTS = [
  { type: 'cut', words: ['без переход', 'встык', 'жёстк', 'жестк', 'hard cut', 'резк'] },
  { type: 'fadeblack', words: ['через чёрн', 'через черн', 'затемнен', 'fade to black'] },
  { type: 'dissolve', words: ['раствор', 'dissolve'] },
  { type: 'slideleft', words: ['сдвиг', 'slide', 'свайп', 'swipe'] },
  { type: 'wipeleft', words: ['шторк', 'wipe'] },
  { type: 'circleopen', words: ['круг', 'circle'] },
  { type: 'pixelize', words: ['пиксел', 'pixelize'] },
  { type: 'fade', words: ['плавн переход', 'плавные переход', 'мягк переход', 'crossfade', 'кроссфейд', 'с переход', 'переход'] },
];

const FIT_HINTS = [
  { fit: 'blur-pad', words: ['размыт фон', 'размытый фон', 'блюр фон', 'blur background', 'с полями размыт'] },
  { fit: 'contain', words: ['целиком', 'не обрезай', 'полностью в кадр', 'с полями', 'letterbox', 'fit'] },
  { fit: 'cover', words: ['на весь экран', 'обрежь под формат', 'заполн', 'crop', 'fill'] },
];

export function planHeuristically(prompt, assets, { preset: presetOverride } = {}) {
  const text = String(prompt || '').toLowerCase();
  const visual = [...assets.values()].filter((a) => a.kind === 'video' || a.kind === 'image');
  const music = [...assets.values()].find((a) => a.kind === 'audio');

  const preset = presetOverride && PRESETS[presetOverride]
    ? presetOverride
    : PRESET_HINTS.find((h) => h.words.some((w) => text.includes(w)))?.preset || DEFAULT_PRESET;

  const tempo = FAST_WORDS.some((w) => text.includes(w))
    ? 'fast'
    : SLOW_WORDS.some((w) => text.includes(w))
      ? 'slow'
      : 'normal';

  const transition = TRANSITION_HINTS.find((h) => h.words.some((w) => text.includes(w)))?.type
    ?? (tempo === 'slow' ? 'fade' : 'cut');
  const transitionDuration = tempo === 'slow' ? 0.8 : 0.4;

  const fit = FIT_HINTS.find((h) => h.words.some((w) => text.includes(w)))?.fit || 'cover';
  // «Размытый фон» — это способ вписать кадр, а не эффект размытия поверх видео.
  // Убираем такие фразы из текста, иначе они ложно поднимают эффект blur.
  const effectText = FIT_HINTS.flatMap((h) => h.words).reduce((acc, word) => acc.split(word).join(' '), text);
  const effects = detectEffects(effectText);
  const speed = detectSpeed(text);
  const targetTotal = detectDuration(text);
  const captions = extractQuoted(prompt);

  const clipTarget = tempo === 'fast' ? 1.4 : tempo === 'slow' ? 5 : 2.8;
  const wantsSlicing = tempo === 'fast' || /нарез|наруб|раздроб|куск|slice|chop/.test(text);

  const segments = [];
  for (const asset of visual) {
    if (asset.kind === 'image') {
      segments.push({ assetId: asset.id, duration: clipTarget * (tempo === 'fast' ? 1.2 : 1) });
      continue;
    }
    const duration = asset.duration || clipTarget;
    if (wantsSlicing && duration > clipTarget * 2) {
      // Длинное видео под быстрый темп режем на равные куски по всей длине.
      const count = Math.min(8, Math.max(2, Math.floor(duration / clipTarget)));
      const stride = duration / count;
      for (let i = 0; i < count; i += 1) {
        const start = i * stride;
        segments.push({ assetId: asset.id, start, end: Math.min(duration, start + clipTarget) });
      }
    } else {
      segments.push({ assetId: asset.id, start: 0, end: Math.min(duration, Math.max(clipTarget, Math.min(duration, 12))) });
    }
  }

  if (targetTotal && segments.length) fitToDuration(segments, targetTotal, speed);

  const clips = segments.map((segment, index) => ({
    ...segment,
    speed,
    effects,
    transition: { type: index === 0 ? 'cut' : transition, duration: transitionDuration },
    text: captions[index] ? [{
      text: captions[index],
      start: 0.1,
      end: 99,
      position: /сверху|вверх|top/.test(text) ? 'top' : /по центру|center/.test(text) ? 'center' : 'bottom',
      animation: tempo === 'fast' ? 'pop' : 'fade',
    }] : [],
  }));

  const keepOriginal = !/без звук|убери звук|убрать звук|заглуши|mute|без оригинальн/.test(text);

  return {
    title: captions[0] || 'Монтаж по описанию',
    output: { preset, fit, ...PRESETS[preset] },
    clips,
    music: music ? {
      assetId: music.id,
      volume: keepOriginal ? 0.45 : 0.85,
      fadeIn: 0.6,
      fadeOut: Math.min(2, transitionDuration * 3),
      duckOriginal: keepOriginal && /голос|речь|говор|voice|подкаст/.test(text),
    } : null,
    audio: { keepOriginal, originalVolume: music && keepOriginal ? 0.8 : 1 },
    notes: describe({ preset, tempo, transition, effects, speed, targetTotal, music: !!music, keepOriginal, clips: clips.length }),
  };
}

function detectEffects(text) {
  const found = [];
  for (const [id, def] of Object.entries(EFFECTS)) {
    if (def.aliases.some((alias) => text.includes(alias))) {
      found.push({ type: id, intensity: detectIntensity(text) });
    }
  }
  return found.slice(0, 4);
}

function detectIntensity(text) {
  if (/чуть|слегка|немног|лёгк|легк|subtle|slight/.test(text)) return 0.3;
  if (/сильн|максимал|жёстк|жестк|очень|heavy|max/.test(text)) return 0.9;
  return 0.6;
}

function detectSpeed(text) {
  const explicit = /(?:ускор|быстрее|speed up)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(?:раз|x|х)?/.exec(text);
  if (explicit) return clampSpeed(Number(explicit[1].replace(',', '.')));
  const slowed = /(?:замедл|slow(?:\s*mo)?|слоумо)[^\d]{0,20}(\d+(?:[.,]\d+)?)?/.exec(text);
  if (slowed) return slowed[1] ? clampSpeed(1 / Number(slowed[1].replace(',', '.'))) : 0.5;
  if (/ускор|быстрее|speed up/.test(text)) return 1.5;
  return 1;
}

const clampSpeed = (v) => (Number.isFinite(v) && v > 0 ? Math.min(8, Math.max(0.25, v)) : 1);

function detectDuration(text) {
  const min = /(\d+(?:[.,]\d+)?)\s*(?:минут|мин\b|minute|min\b)/.exec(text);
  if (min) return Math.min(600, Number(min[1].replace(',', '.')) * 60);
  const sec = /(\d+(?:[.,]\d+)?)\s*(?:секунд|сек\b|second|sec\b|s\b)/.exec(text);
  if (sec) return Math.min(600, Number(sec[1].replace(',', '.')));
  return null;
}

/** Пропорционально подгоняет длительности сегментов под заданный хронометраж. */
function fitToDuration(segments, targetTotal, speed) {
  const current = segments.reduce(
    (sum, s) => sum + (s.duration ?? (s.end - s.start)) / speed,
    0,
  );
  if (current <= 0) return;
  const factor = targetTotal / current;
  for (const segment of segments) {
    if (segment.duration != null) {
      segment.duration = Math.max(0.4, segment.duration * factor);
    } else {
      const span = Math.max(0.4, (segment.end - segment.start) * factor);
      segment.end = segment.start + span;
    }
  }
}

/** Подписи берём из кавычек — так пользователь задаёт точный текст на экране. */
function extractQuoted(prompt) {
  const found = [];
  for (const m of String(prompt || '').matchAll(/[«"'“”„]([^«»"'“”„]{1,120})[»"'“”]/g)) {
    const value = m[1].trim();
    if (value) found.push(value);
  }
  return found;
}

function describe({ preset, tempo, transition, effects, speed, targetTotal, music, keepOriginal, clips }) {
  const parts = [
    `Формат: ${PRESETS[preset].label}.`,
    `Клипов: ${clips}, темп ${tempo === 'fast' ? 'быстрый' : tempo === 'slow' ? 'спокойный' : 'средний'}.`,
    `Переходы: ${transition === 'cut' ? 'встык' : transition}.`,
  ];
  if (effects.length) parts.push(`Эффекты: ${effects.map((e) => EFFECTS[e.type].label).join(', ')}.`);
  if (speed !== 1) parts.push(`Скорость: ×${speed}.`);
  if (targetTotal) parts.push(`Целевой хронометраж: ${targetTotal} с.`);
  if (music) parts.push('Подложил загруженную музыку.');
  if (!keepOriginal) parts.push('Оригинальный звук выключен.');
  return parts.join(' ');
}
