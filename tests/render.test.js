import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, describe, before, after } from 'node:test';

import { probe, runFfmpeg } from '../server/ffmpeg.js';
import { normalizePlan } from '../server/plan-schema.js';
import { renderPlan } from '../server/renderer.js';

/**
 * Интеграционные проверки рендера. Материал генерируется самим ffmpeg,
 * поэтому тесты не тянут за собой бинарные фикстуры и одинаково работают в CI.
 */

let dir;
const assets = new Map();

async function makeAsset(id, name, args) {
  const file = path.join(dir, name);
  await runFfmpeg(args.concat([file]));
  assets.set(id, { id, originalName: name, storagePath: file, ...(await probe(file)) });
}

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-test-'));

  await makeAsset('withSound', 'sound.mp4', [
    '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25:duration=4',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
  ]);

  await makeAsset('silent', 'silent.mp4', [
    '-f', 'lavfi', '-i', 'smptebars=size=240x320:rate=25:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  ]);

  await makeAsset('photo', 'photo.png', [
    '-f', 'lavfi', '-i', 'gradients=size=400x300:duration=1:rate=1', '-frames:v', '1',
  ]);

  await makeAsset('music', 'music.mp3', [
    '-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.3', '-c:a', 'libmp3lame',
  ]);
});

after(async () => {
  if (dir) await fs.rm(dir, { recursive: true, force: true });
});

async function render(name, rawPlan) {
  const { plan } = normalizePlan(rawPlan, assets);
  const outputPath = path.join(dir, `${name}.mp4`);
  await renderPlan(plan, assets, { jobDir: path.join(dir, `work-${name}`), outputPath });
  return { plan, meta: await probe(outputPath) };
}

const expectedDuration = (plan) =>
  plan.clips.reduce((sum, c) => sum + c.duration, 0)
  - plan.clips.slice(1).reduce((sum, c) => sum + (c.transition.type === 'cut' ? 0 : c.transition.duration), 0);

describe('рендер', { concurrency: 1, timeout: 240000 }, () => {
  test('склейка встык даёт заданный кадр и длительность', async () => {
    const { plan, meta } = await render('cuts', {
      output: { preset: 'reels' },
      clips: [
        { assetId: 'withSound', start: 0.5, end: 2 },
        { assetId: 'silent', start: 0, end: 1.5 },
      ],
    });
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1920);
    assert.equal(meta.fps, 30);
    assert.ok(meta.hasAudio, 'звуковая дорожка нужна даже когда часть клипов без звука');
    assert.ok(Math.abs(meta.duration - expectedDuration(plan)) < 0.3);
  });

  test('видео без звуковой дорожки не ломает рендер', async () => {
    const { meta } = await render('silent-only', {
      output: { preset: 'square' },
      clips: [{ assetId: 'silent', start: 0, end: 2 }],
    });
    assert.equal(meta.width, 1080);
    assert.ok(meta.hasAudio, 'к немому исходнику подставляется тишина');
  });

  test('ролик из одних фотографий', async () => {
    const { plan, meta } = await render('photos', {
      output: { preset: 'youtube' },
      clips: [
        { assetId: 'photo', duration: 1.5, effects: [{ type: 'kenburns', intensity: 0.6 }] },
        { assetId: 'photo', duration: 1.5, effects: [{ type: 'grayscale' }], transition: { type: 'fade', duration: 0.5 } },
      ],
    });
    assert.equal(meta.width, 1920);
    assert.ok(Math.abs(meta.duration - expectedDuration(plan)) < 0.3);
  });

  test('переходы укорачивают ролик на длину склейки', async () => {
    const { plan, meta } = await render('xfade', {
      output: { preset: 'square' },
      clips: [
        { assetId: 'withSound', start: 0, end: 2 },
        { assetId: 'silent', start: 0, end: 2, transition: { type: 'circleopen', duration: 0.5 } },
        { assetId: 'photo', duration: 1.5, transition: { type: 'wipeleft', duration: 0.4 } },
      ],
    });
    const expected = expectedDuration(plan);
    assert.ok(expected < 5.5, 'переходы должны съесть часть хронометража');
    assert.ok(Math.abs(meta.duration - expected) < 0.4, `ожидал ~${expected}, получил ${meta.duration}`);
  });

  test('скорость меняет длительность клипа', async () => {
    const { plan, meta } = await render('speed', {
      output: { preset: 'square' },
      clips: [{ assetId: 'withSound', start: 0, end: 4, speed: 2 }],
    });
    assert.equal(plan.clips[0].duration, 2);
    assert.ok(Math.abs(meta.duration - 2) < 0.3);
  });

  test('музыка подмешивается и не меняет длину ролика', async () => {
    const { plan, meta } = await render('music', {
      output: { preset: 'reels', fit: 'blur-pad' },
      clips: [{ assetId: 'silent', start: 0, end: 2 }],
      music: { assetId: 'music', volume: 0.6, fadeIn: 0.3, fadeOut: 0.5 },
    });
    assert.ok(meta.hasAudio);
    assert.ok(Math.abs(meta.duration - expectedDuration(plan)) < 0.4);
  });

  test('музыка короче ролика зацикливается', async () => {
    const short = path.join(dir, 'short.mp3');
    await runFfmpeg(['-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', '-c:a', 'libmp3lame', short]);
    assets.set('shortMusic', { id: 'shortMusic', originalName: 'short.mp3', storagePath: short, ...(await probe(short)) });

    const { meta } = await render('loop-music', {
      output: { preset: 'square' },
      clips: [{ assetId: 'silent', start: 0, end: 3 }],
      music: { assetId: 'shortMusic', volume: 0.5 },
    });
    assert.ok(meta.duration > 2.5, 'ролик не должен обрезаться по длине музыки');
  });

  test('титры с кириллицей доживают до готового файла', async () => {
    const { meta } = await render('captions', {
      output: { preset: 'reels' },
      clips: [{
        assetId: 'silent', start: 0, end: 2,
        text: [
          { text: 'Привет, монтаж!', start: 0, end: 2, position: 'bottom', animation: 'slide-up' },
          { text: 'Вторая строка', start: 0.5, end: 2, position: 'top', animation: 'typewriter' },
        ],
      }],
    });
    assert.ok(meta.duration > 1.5);
  });
});
