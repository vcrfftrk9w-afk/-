import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { normalizePlan, TRANSITIONS } from '../server/plan-schema.js';
import { buildAss, toAssColor, toAssTime } from '../server/ass.js';
import { buildEffect, EFFECT_IDS } from '../server/effects.js';
import { atempoChain, geometrySteps } from '../server/renderer.js';
import { planHeuristically } from '../server/heuristic.js';

const assets = () => new Map([
  ['vid', { id: 'vid', kind: 'video', duration: 10, originalName: 'clip.mp4', hasAudio: true }],
  ['pic', { id: 'pic', kind: 'image', duration: 0, originalName: 'photo.jpg', hasAudio: false }],
  ['mus', { id: 'mus', kind: 'audio', duration: 60, originalName: 'track.mp3', hasAudio: true }],
]);

describe('нормализация плана', () => {
  test('зажимает выходящие за пределы значения', () => {
    const { plan } = normalizePlan({
      clips: [{ assetId: 'vid', start: -5, end: 900, speed: 99, volume: 12 }],
    }, assets());
    const clip = plan.clips[0];
    assert.equal(clip.start, 0);
    assert.equal(clip.end, 10, 'конец не выходит за длительность исходника');
    assert.equal(clip.speed, 8);
    assert.equal(clip.volume, 2);
  });

  test('отбрасывает неизвестные эффекты и переходы', () => {
    const { plan, warnings } = normalizePlan({
      clips: [
        { assetId: 'vid' },
        { assetId: 'pic', effects: [{ type: 'drop_tables' }, 'grayscale'], transition: { type: 'teleport' } },
      ],
    }, assets());
    assert.deepEqual(plan.clips[1].effects.map((e) => e.type), ['grayscale']);
    assert.ok(TRANSITIONS.includes(plan.clips[1].transition.type));
    assert.ok(warnings.some((w) => w.includes('drop_tables')));
  });

  test('первый клип всегда встык', () => {
    const { plan } = normalizePlan({
      clips: [{ assetId: 'vid', transition: { type: 'fade', duration: 2 } }],
    }, assets());
    assert.equal(plan.clips[0].transition.type, 'cut');
    assert.equal(plan.clips[0].transition.duration, 0);
  });

  test('переход не длиннее половины клипа', () => {
    const { plan } = normalizePlan({
      clips: [
        { assetId: 'vid', start: 0, end: 4 },
        { assetId: 'vid', start: 0, end: 1, transition: { type: 'fade', duration: 3 } },
      ],
    }, assets());
    assert.ok(plan.clips[1].transition.duration <= plan.clips[1].duration / 2);
  });

  test('находит исходник по имени файла и по номеру', () => {
    const { plan } = normalizePlan({
      clips: [{ assetId: 'photo.jpg' }, { assetId: '1' }],
    }, assets());
    assert.equal(plan.clips[0].assetId, 'pic');
    assert.equal(plan.clips[1].assetId, 'pic', 'индекс 1 — второй визуальный исходник');
  });

  test('пустой план собирается из всех визуальных исходников', () => {
    const { plan } = normalizePlan({}, assets());
    assert.deepEqual(plan.clips.map((c) => c.assetId), ['vid', 'pic']);
  });

  test('музыка без аудиодорожки отбрасывается с предупреждением', () => {
    const { plan, warnings } = normalizePlan({
      clips: [{ assetId: 'vid' }],
      music: { assetId: 'pic' },
    }, assets());
    assert.equal(plan.music, null);
    assert.ok(warnings.some((w) => w.includes('photo.jpg')));
  });

  test('длительность надписи не выходит за клип', () => {
    const { plan } = normalizePlan({
      clips: [{ assetId: 'vid', start: 0, end: 2, text: [{ text: 'Хэй', start: 0, end: 500 }] }],
    }, assets());
    assert.ok(plan.clips[0].text[0].end <= 2.001);
  });

  test('ширина и высота кадра всегда чётные', () => {
    const { plan } = normalizePlan({
      output: { width: 1081, height: 1921 }, clips: [{ assetId: 'vid' }],
    }, assets());
    assert.equal(plan.output.width % 2, 0);
    assert.equal(plan.output.height % 2, 0);
  });
});

describe('титры в ASS', () => {
  test('цвет переводится в BGR с альфой', () => {
    assert.equal(toAssColor('#FF8800'), '&H000088FF');
    assert.equal(toAssColor('мусор'), '&H00FFFFFF', 'некорректный цвет откатывается к белому');
  });

  test('время округляется до сотых с переносом', () => {
    assert.equal(toAssTime(75.267), '0:01:15.27');
    assert.equal(toAssTime(0), '0:00:00.00');
    assert.equal(toAssTime(1.999), '0:00:02.00');
  });

  test('разметка в тексте пользователя обезвреживается', () => {
    const ass = buildAss([{ text: '{\\move(0,0,9999,9999)}взлом', start: 0, end: 1 }], { width: 100, height: 100 });
    const dialogue = ass.split('\n').find((l) => l.startsWith('Dialogue'));
    assert.ok(!dialogue.includes('{\\move'), 'фигурные скобки не должны открывать блок переопределения');
    assert.ok(dialogue.includes('взлом'));
  });

  test('пустой список титров не создаёт файл', () => {
    assert.equal(buildAss([], { width: 100, height: 100 }), null);
    assert.equal(buildAss([{ text: '   ' }], { width: 100, height: 100 }), null);
  });

  test('одинаковые стили переиспользуются', () => {
    const ass = buildAss([
      { text: 'раз', start: 0, end: 1, position: 'top', size: 40 },
      { text: 'два', start: 1, end: 2, position: 'top', size: 40 },
    ], { width: 100, height: 100 });
    assert.equal(ass.match(/^Style: /gm).length, 1);
  });
});

describe('фильтры', () => {
  test('каждый эффект собирается без пустых звеньев', () => {
    const ctx = { width: 1080, height: 1920, fps: 30, duration: 4 };
    for (const id of EFFECT_IDS) {
      const chain = buildEffect({ type: id, intensity: 0.7 }, ctx);
      assert.ok(chain.length > 0, `${id} ничего не вернул`);
      for (const step of chain) {
        assert.equal(typeof step, 'string');
        assert.ok(step.trim().length > 0, `${id} вернул пустой фильтр`);
      }
    }
  });

  test('неизвестный эффект молча пропускается', () => {
    assert.deepEqual(buildEffect({ type: 'nope' }, { width: 10, height: 10, fps: 30 }), []);
  });

  test('atempo раскладывается за пределами 0.5–2', () => {
    assert.deepEqual(atempoChain(1), []);
    assert.equal(atempoChain(4).length, 2);
    assert.equal(atempoChain(8).length, 3);
    assert.equal(atempoChain(0.25).length, 2);
    const product = atempoChain(4).reduce((acc, s) => acc * Number(s.split('=')[1]), 1);
    assert.ok(Math.abs(product - 4) < 1e-6, 'произведение шагов равно запрошенной скорости');
  });

  test('вписывание в кадр даёт разные цепочки', () => {
    const frame = { width: 1080, height: 1920 };
    assert.ok(geometrySteps('cover', frame).some((s) => s.startsWith('crop=')));
    assert.ok(geometrySteps('contain', frame).some((s) => s.startsWith('pad=')));
    assert.deepEqual(geometrySteps('blur-pad', frame), [], 'размытый фон строится отдельным графом');
  });
});

describe('локальный разбор запроса', () => {
  const a = assets();

  test('узнаёт формат кадра', () => {
    assert.equal(planHeuristically('вертикальный ролик', a).output.preset, 'reels');
    assert.equal(planHeuristically('для ютуба', a).output.preset, 'youtube');
    assert.equal(planHeuristically('квадрат в ленту', a).output.preset, 'square');
  });

  test('быстрый темп режет видео на куски', () => {
    const fast = planHeuristically('динамичный эдит под бит', a);
    const slow = planHeuristically('спокойный размеренный ролик', a);
    assert.ok(fast.clips.length > slow.clips.length);
  });

  test('достаёт подписи из кавычек', () => {
    const plan = planHeuristically('сделай эдит с подписью «Лето 2026»', a);
    assert.equal(plan.clips[0].text[0].text, 'Лето 2026');
  });

  test('понимает скорость и хронометраж', () => {
    assert.equal(planHeuristically('ускорь в 2 раза', a).clips[0].speed, 2);
    assert.equal(planHeuristically('замедли', a).clips[0].speed, 0.5);
    const timed = planHeuristically('динамично, 10 секунд', a);
    const total = timed.clips.reduce((s, c) => s + (c.duration ?? (c.end - c.start)) / c.speed, 0);
    assert.ok(Math.abs(total - 10) < 0.5, `ожидал ~10 с, получил ${total}`);
  });

  test('«размытый фон» не включает эффект размытия', () => {
    const plan = planHeuristically('вписать на размытый фон', a);
    assert.equal(plan.output.fit, 'blur-pad');
    assert.ok(!plan.clips[0].effects.some((e) => e.type === 'blur'));
  });

  test('выключает оригинальный звук по просьбе', () => {
    assert.equal(planHeuristically('без звука', a).audio.keepOriginal, false);
    assert.equal(planHeuristically('обычный ролик', a).audio.keepOriginal, true);
  });
});
