import Anthropic from '@anthropic-ai/sdk';

import { ANTHROPIC_API_KEY, PLANNER_MODEL, PRESETS } from './config.js';
import { EFFECT_IDS, EFFECTS, effectsCatalogForPrompt } from './effects.js';
import { TRANSITIONS, FIT_MODES } from './plan-schema.js';
import { TEXT_POSITIONS, TEXT_ANIMATIONS } from './ass.js';
import { planHeuristically } from './heuristic.js';

/**
 * Планировщик превращает фразу пользователя в монтажный план.
 *
 * Основной путь — Claude: он видит список исходников с длительностями и
 * возвращает план через tool use, то есть сразу структурой, а не текстом.
 * Если ключа нет или запрос не прошёл, план собирает локальный парсер —
 * редактор остаётся рабочим, просто менее сообразительным.
 */

const PLAN_TOOL = {
  name: 'submit_edit_plan',
  description: 'Отдать готовый монтажный план, который движок отрендерит через ffmpeg.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Короткое название ролика.' },
      notes: {
        type: 'string',
        description: 'Объяснение для пользователя на его языке: что именно ты смонтировал и почему. 2–4 предложения.',
      },
      output: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: Object.keys(PRESETS) },
          fps: { type: 'integer', minimum: 12, maximum: 60 },
          fit: {
            type: 'string',
            enum: FIT_MODES,
            description: 'cover — обрезать под кадр; contain — вписать с чёрными полями; blur-pad — вписать на размытый фон.',
          },
        },
        required: ['preset'],
      },
      clips: {
        type: 'array',
        description: 'Клипы в порядке показа. Один исходник можно использовать много раз с разными кусками.',
        items: {
          type: 'object',
          properties: {
            assetId: { type: 'string', description: 'id исходника из списка.' },
            start: { type: 'number', description: 'Секунда начала куска в исходном видео. Для картинок 0.' },
            end: { type: 'number', description: 'Секунда конца куска. Не больше длительности исходника.' },
            duration: { type: 'number', description: 'Для картинок — сколько секунд держать в кадре.' },
            speed: { type: 'number', description: '1 — обычная, 2 — вдвое быстрее, 0.5 — слоумо.' },
            volume: { type: 'number', description: 'Громкость оригинальной дорожки клипа, 0..2.' },
            effects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: EFFECT_IDS },
                  intensity: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['type'],
              },
            },
            transition: {
              type: 'object',
              description: 'Как этот клип появляется после предыдущего. У первого клипа игнорируется.',
              properties: {
                type: { type: 'string', enum: TRANSITIONS },
                duration: { type: 'number', minimum: 0.1, maximum: 3 },
              },
              required: ['type'],
            },
            text: {
              type: 'array',
              description: 'Надписи поверх этого клипа. Время отсчитывается от начала клипа.',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  start: { type: 'number' },
                  end: { type: 'number' },
                  position: { type: 'string', enum: TEXT_POSITIONS },
                  size: { type: 'integer' },
                  color: { type: 'string', description: 'HEX, например #FFEE00.' },
                  outlineColor: { type: 'string' },
                  animation: { type: 'string', enum: TEXT_ANIMATIONS },
                },
                required: ['text'],
              },
            },
          },
          required: ['assetId'],
        },
      },
      music: {
        type: 'object',
        description: 'Музыкальная подложка. Только если среди исходников есть аудиофайл.',
        properties: {
          assetId: { type: 'string' },
          volume: { type: 'number', minimum: 0, maximum: 2 },
          fadeIn: { type: 'number' },
          fadeOut: { type: 'number' },
          duckOriginal: { type: 'boolean', description: 'Приглушать музыку под речь в оригинальной дорожке.' },
        },
        required: ['assetId'],
      },
      audio: {
        type: 'object',
        properties: {
          keepOriginal: { type: 'boolean' },
          originalVolume: { type: 'number', minimum: 0, maximum: 2 },
        },
      },
    },
    required: ['title', 'clips', 'output', 'notes'],
  },
};

function buildSystemPrompt() {
  return [
    'Ты — монтажёр. Пользователь загружает видео, фото и музыку и описывает словами, какой ролик хочет.',
    'Твоя работа — вернуть монтажный план через инструмент submit_edit_plan. Никакого другого ответа не нужно.',
    '',
    'Как думать о задаче:',
    '- Ритм важнее эффектов. Под динамичный запрос делай короткие клипы (0.8–2 с), под спокойный — длинные (4–8 с).',
    '- Режь одно длинное видео на несколько клипов с разными кусками, если это оживит ролик.',
    '- Эффекты применяй осмысленно: 1–2 на клип. Сплошной стек фильтров выглядит грязно.',
    '- Переходы: «встык» (cut) — норма для динамики; fade и dissolve — для спокойного темпа; экзотику бери, когда пользователь сам просит.',
    '- Надписи пиши на языке пользователя. Если он дал текст в кавычках — используй его дословно.',
    '- Если есть аудиофайл, почти всегда стоит подложить его музыкой.',
    '- Не выдумывай исходники: assetId бери строго из списка ниже.',
    '- start/end не должны выходить за длительность исходника.',
    '',
    'Доступные эффекты:',
    effectsCatalogForPrompt(),
    '',
    `Доступные переходы: ${TRANSITIONS.join(', ')}.`,
    `Позиции надписей: ${TEXT_POSITIONS.join(', ')}.`,
    `Анимации надписей: ${TEXT_ANIMATIONS.join(', ')}.`,
    '',
    'Поле notes заполняй на языке пользователя — это объяснение, которое он прочитает в интерфейсе.',
  ].join('\n');
}

function describeAssets(assets) {
  const lines = [...assets.values()].map((asset, index) => {
    const bits = [`#${index + 1}`, `assetId=${asset.id}`, `тип=${asset.kind}`, `файл=${asset.originalName}`];
    if (asset.duration) bits.push(`длительность=${asset.duration.toFixed(2)}с`);
    if (asset.width) bits.push(`кадр=${asset.width}x${asset.height}`);
    if (asset.kind === 'video') bits.push(`звук=${asset.hasAudio ? 'есть' : 'нет'}`);
    return bits.join(', ');
  });
  return lines.join('\n');
}

export function plannerAvailable() {
  return Boolean(ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * @returns {{plan: object, source: 'model'|'heuristic', error?: string}}
 */
export async function createPlan({ prompt, assets, preset, previousPlan }) {
  if (!plannerAvailable()) {
    return { plan: planHeuristically(prompt, assets, { preset }), source: 'heuristic' };
  }

  try {
    const plan = await planWithModel({ prompt, assets, preset, previousPlan });
    return { plan, source: 'model' };
  } catch (error) {
    // Модель может быть недоступна, перегружена или вернуть мусор — это не повод
    // ронять запрос: локальный парсер соберёт рабочий план из того же промпта.
    return {
      plan: planHeuristically(prompt, assets, { preset }),
      source: 'heuristic',
      error: error?.message || String(error),
    };
  }
}

async function planWithModel({ prompt, assets, preset, previousPlan }) {
  const client = new Anthropic(ANTHROPIC_API_KEY ? { apiKey: ANTHROPIC_API_KEY } : {});

  const userContent = [
    'Исходники:',
    describeAssets(assets),
    '',
    preset ? `Пользователь выбрал формат кадра: ${preset} (${PRESETS[preset]?.label}).` : '',
    previousPlan ? `Это правка уже собранного ролика. Предыдущий план:\n${JSON.stringify(stripPlan(previousPlan))}` : '',
    '',
    'Запрос пользователя:',
    prompt,
  ].filter(Boolean).join('\n');

  const response = await client.messages.create({
    model: PLANNER_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: buildSystemPrompt(),
    tools: [PLAN_TOOL],
    tool_choice: { type: 'tool', name: PLAN_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Модель отказалась обрабатывать запрос.');
  }

  const call = response.content.find((block) => block.type === 'tool_use' && block.name === PLAN_TOOL.name);
  if (!call) throw new Error('Модель не вернула монтажный план.');
  return call.input;
}

/** В план для модели не нужны служебные поля — короче промпт, меньше шума. */
function stripPlan(plan) {
  return {
    output: plan.output,
    clips: plan.clips?.map((c) => ({
      assetId: c.assetId, start: c.start, end: c.end, speed: c.speed,
      effects: c.effects?.map((e) => e.type), transition: c.transition?.type,
      text: c.text?.map((t) => t.text),
    })),
    music: plan.music ? { assetId: plan.music.assetId, volume: plan.music.volume } : null,
  };
}

export { PLAN_TOOL, buildSystemPrompt, describeAssets, EFFECTS };
