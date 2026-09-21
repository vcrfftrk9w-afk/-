/**
 * Каталог эффектов. Каждый эффект — это чистая функция
 * (интенсивность 0..1, контекст кадра) -> список ffmpeg-фильтров,
 * которые можно поставить в один линейный filterchain.
 *
 * `aliases` используется и локальным парсером промпта, и подсказкой для модели,
 * поэтому в них лежат и русские, и английские формулировки.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const num = (v, fallback = 0.5) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export const EFFECTS = {
  grayscale: {
    label: 'Чёрно-белое',
    aliases: ['чб', 'ч/б', 'чёрно-белое', 'черно-белое', 'монохром', 'grayscale', 'black and white', 'bw', 'mono'],
    build: (i) => [`hue=s=${(1 - clamp(num(i, 1), 0, 1)).toFixed(3)}`],
  },
  sepia: {
    label: 'Сепия',
    aliases: ['сепия', 'sepia', 'состаренное'],
    build: () => ['colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131'],
  },
  vintage: {
    label: 'Плёнка / винтаж',
    aliases: ['винтаж', 'плёнка', 'пленка', 'ретро', 'vhs', 'vintage', 'retro', 'film', 'old'],
    build: (i, ctx) => [
      'curves=preset=vintage',
      `noise=alls=${Math.round(lerp(6, 22, num(i)))}:allf=t`,
      `vignette=PI/${lerp(5.5, 3.6, num(i)).toFixed(2)}`,
      ...(ctx.fps >= 24 ? [] : []),
    ],
  },
  vibrant: {
    label: 'Сочные цвета',
    aliases: ['сочн', 'насыщен', 'ярче', 'vivid', 'vibrant', 'saturate', 'pop'],
    build: (i) => [`eq=saturation=${lerp(1.15, 1.9, num(i)).toFixed(3)}:contrast=${lerp(1.02, 1.18, num(i)).toFixed(3)}`],
  },
  cinematic: {
    label: 'Кинолук (teal & orange)',
    aliases: ['кино', 'киношн', 'cinematic', 'teal', 'blockbuster', 'кинолук', 'фильм'],
    build: (i) => [
      `colorbalance=rs=${lerp(0.02, 0.08, num(i)).toFixed(3)}:gs=-0.01:bs=${(-lerp(0.02, 0.09, num(i))).toFixed(3)}:rh=${(-lerp(0.02, 0.07, num(i))).toFixed(3)}:bh=${lerp(0.04, 0.13, num(i)).toFixed(3)}`,
      `eq=contrast=${lerp(1.05, 1.22, num(i)).toFixed(3)}:saturation=${lerp(1.0, 1.15, num(i)).toFixed(3)}`,
    ],
  },
  cold: {
    label: 'Холодный тон',
    aliases: ['холодн', 'синий тон', 'cold', 'cool', 'blue tone'],
    build: (i) => [`colorbalance=rs=${(-lerp(0.05, 0.16, num(i))).toFixed(3)}:bs=${lerp(0.05, 0.18, num(i)).toFixed(3)}`],
  },
  warm: {
    label: 'Тёплый тон',
    aliases: ['тёпл', 'тепл', 'жёлт', 'warm', 'golden', 'sunset'],
    build: (i) => [`colorbalance=rs=${lerp(0.05, 0.16, num(i)).toFixed(3)}:bs=${(-lerp(0.05, 0.16, num(i))).toFixed(3)}`],
  },
  contrast: {
    label: 'Контраст',
    aliases: ['контраст', 'contrast', 'жёстче', 'punchy'],
    build: (i) => [`eq=contrast=${lerp(1.1, 1.45, num(i)).toFixed(3)}`],
  },
  brighten: {
    label: 'Светлее',
    aliases: ['светл', 'ярче картинку', 'brighten', 'exposure up'],
    build: (i) => [`eq=brightness=${lerp(0.04, 0.18, num(i)).toFixed(3)}`],
  },
  darken: {
    label: 'Темнее',
    aliases: ['темн', 'затемн', 'darken', 'moody'],
    build: (i) => [`eq=brightness=${(-lerp(0.04, 0.18, num(i))).toFixed(3)}`],
  },
  blur: {
    label: 'Размытие',
    aliases: ['размы', 'размо', 'блюр', 'blur', 'soft focus', 'не в фокусе'],
    build: (i) => [`gblur=sigma=${lerp(1.5, 12, num(i)).toFixed(2)}`],
  },
  sharpen: {
    label: 'Резкость',
    aliases: ['резкост', 'чётче', 'четче', 'sharpen', 'crisp'],
    build: (i) => [`unsharp=5:5:${lerp(0.6, 1.8, num(i)).toFixed(2)}:5:5:0`],
  },
  vignette: {
    label: 'Виньетка',
    aliases: ['виньет', 'vignette', 'затемнение по краям'],
    build: (i) => [`vignette=PI/${lerp(5.5, 3.4, num(i)).toFixed(2)}`],
  },
  filmgrain: {
    label: 'Плёночное зерно',
    aliases: ['зерно', 'grain', 'шум плёнки', 'noise'],
    build: (i) => [`noise=alls=${Math.round(lerp(8, 30, num(i)))}:allf=t+u`],
  },
  glitch: {
    label: 'Глитч',
    aliases: ['глитч', 'glitch', 'помехи', 'искажен', 'rgb split', 'хроматическая'],
    build: (i) => [
      `chromashift=cbh=${Math.round(lerp(4, 14, num(i)))}:crh=${Math.round(-lerp(4, 14, num(i)))}`,
      `noise=alls=${Math.round(lerp(10, 26, num(i)))}:allf=t`,
    ],
  },
  pixelate: {
    label: 'Пикселизация',
    aliases: ['пиксел', 'pixelate', 'мозаик', '8 bit', '8-bit'],
    build: (i, ctx) => {
      const factor = Math.round(lerp(6, 40, num(i)));
      const w = Math.max(2, Math.round(ctx.width / factor) * 2);
      const h = Math.max(2, Math.round(ctx.height / factor) * 2);
      return [`scale=${w}:${h}:flags=neighbor`, `scale=${ctx.width}:${ctx.height}:flags=neighbor`];
    },
  },
  mirror: {
    label: 'Зеркало по горизонтали',
    aliases: ['зеркал', 'отзеркал', 'mirror', 'flip horizontal', 'hflip'],
    build: () => ['hflip'],
  },
  invert: {
    label: 'Инверсия цвета',
    aliases: ['инверс', 'негатив', 'invert', 'negative'],
    build: () => ['negate'],
  },
  dreamy: {
    label: 'Мягкое свечение',
    aliases: ['мягк', 'свечен', 'dreamy', 'glow', 'bloom', 'нежн'],
    build: (i) => [
      `gblur=sigma=${lerp(1.0, 3.0, num(i)).toFixed(2)}`,
      `eq=brightness=${lerp(0.02, 0.07, num(i)).toFixed(3)}:saturation=${lerp(1.05, 1.25, num(i)).toFixed(3)}`,
    ],
  },
  shake: {
    label: 'Тряска камеры',
    aliases: ['тряск', 'дрож', 'shake', 'handheld', 'камера трясётся'],
    build: (i, ctx) => {
      const amp = Math.max(2, Math.round(lerp(4, 22, num(i))));
      const margin = amp * 2;
      const cw = Math.max(2, Math.floor((ctx.width - margin) / 2) * 2);
      const ch = Math.max(2, Math.floor((ctx.height - margin) / 2) * 2);
      return [
        `crop=${cw}:${ch}:'${amp}+${amp}*sin(t*23.3)':'${amp}+${amp}*cos(t*19.7)'`,
        `scale=${ctx.width}:${ctx.height}`,
      ];
    },
  },
  zoomin: {
    label: 'Наезд камеры',
    aliases: ['наезд', 'зум', 'приближ', 'zoom in', 'zoom', 'push in'],
    build: (i, ctx) => [
      `zoompan=z='min(pzoom+${(lerp(0.0006, 0.0028, num(i))).toFixed(5)},${lerp(1.15, 1.6, num(i)).toFixed(3)})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${ctx.width}x${ctx.height}:fps=${ctx.fps}`,
    ],
  },
  zoomout: {
    label: 'Отъезд камеры',
    aliases: ['отъезд', 'отдал', 'zoom out', 'pull back'],
    build: (i, ctx) => [
      // pzoom на первом кадре равен 1, поэтому стартовый масштаб задаём явно через on==0.
      `zoompan=z='if(eq(on,0),${lerp(1.15, 1.6, num(i)).toFixed(3)},max(pzoom-${lerp(0.0006, 0.0028, num(i)).toFixed(5)},1.0))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${ctx.width}x${ctx.height}:fps=${ctx.fps}`,
    ],
  },
  kenburns: {
    label: 'Кен Бёрнс (медленный наезд с проездом)',
    aliases: ['кен бёрнс', 'кен бернс', 'ken burns', 'оживить фото', 'оживи фото', 'движение по фото', 'паралакс', 'параллакс'],
    build: (i, ctx) => [
      `zoompan=z='min(pzoom+${lerp(0.0005, 0.0018, num(i)).toFixed(5)},${lerp(1.12, 1.35, num(i)).toFixed(3)})':d=1:x='iw/2-(iw/zoom/2)+${Math.round(lerp(10, 60, num(i)))}*sin(on/${Math.max(1, Math.round(ctx.fps * 4))})':y='ih/2-(ih/zoom/2)':s=${ctx.width}x${ctx.height}:fps=${ctx.fps}`,
    ],
  },
  letterbox: {
    label: 'Кинополосы сверху и снизу',
    aliases: ['полосы', 'letterbox', 'кинополос', 'cinemascope', 'чёрные полосы'],
    build: (i, ctx) => {
      const bar = Math.max(2, Math.round((ctx.height * lerp(0.06, 0.13, num(i))) / 2) * 2);
      return [
        `drawbox=x=0:y=0:w=${ctx.width}:h=${bar}:color=black@1:t=fill`,
        `drawbox=x=0:y=${ctx.height - bar}:w=${ctx.width}:h=${bar}:color=black@1:t=fill`,
      ];
    },
  },
  rotate: {
    label: 'Небольшой наклон кадра',
    aliases: ['наклон', 'поворот', 'tilt', 'dutch angle'],
    build: (i, ctx) => [
      `rotate=${lerp(0.02, 0.09, num(i)).toFixed(4)}:ow=${ctx.width}:oh=${ctx.height}:c=black`,
      `scale=${ctx.width}:${ctx.height}`,
    ],
  },
  stabilize: {
    label: 'Стабилизация',
    aliases: ['стабилиз', 'stabilize', 'убрать тряску'],
    build: (i) => [`deshake=rx=${Math.round(lerp(8, 24, num(i)))}:ry=${Math.round(lerp(8, 24, num(i)))}`],
  },
};

export const EFFECT_IDS = Object.keys(EFFECTS);

/** Собирает filterchain для одного эффекта; неизвестный id молча пропускается. */
export function buildEffect(effect, ctx) {
  const def = EFFECTS[effect?.type];
  if (!def) return [];
  return def.build(effect.intensity ?? 0.5, ctx).filter(Boolean);
}

/** Строка для системного промпта планировщика. */
export function effectsCatalogForPrompt() {
  return EFFECT_IDS.map((id) => `- ${id}: ${EFFECTS[id].label}`).join('\n');
}
