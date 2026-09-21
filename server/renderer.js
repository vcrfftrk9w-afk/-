import fs from 'node:fs/promises';
import path from 'node:path';

import { runFfmpeg } from './ffmpeg.js';
import { buildEffect } from './effects.js';
import { buildAss } from './ass.js';

/**
 * Рендер идёт в три прохода вместо одного гигантского filter_complex:
 *   1) каждый клип нормализуется в отдельный файл (единые размер, fps, кодеки);
 *   2) клипы склеиваются — демуксером, если все стыки «встык», иначе xfade;
 *   3) поверх подмешивается музыка.
 * Так граф остаётся читаемым, ошибка локализуется в конкретном клипе,
 * а склейка без переходов проходит вообще без перекодирования.
 */

const VIDEO_ENCODE = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
];

const AUDIO_ENCODE = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

export async function renderPlan(plan, assets, { jobDir, outputPath, onProgress, signal } = {}) {
  await fs.mkdir(jobDir, { recursive: true });

  const frame = { width: plan.output.width, height: plan.output.height, fps: plan.output.fps };
  const totalDuration = plan.clips.reduce((sum, c) => sum + c.duration, 0);
  if (!plan.clips.length || totalDuration <= 0) {
    throw new Error('В плане нет ни одного клипа — нечего рендерить.');
  }

  // Прогресс: клипы + склейка + музыка, взвешенные по секундам материала.
  const musicWeight = plan.music ? totalDuration : 0;
  const totalWork = totalDuration * 2 + musicWeight;
  let doneWork = 0;
  const report = (stage, secondsInStage) => {
    if (!onProgress) return;
    const value = Math.min(0.995, (doneWork + Math.max(0, secondsInStage)) / totalWork);
    onProgress({ stage, progress: value });
  };

  const clipFiles = [];
  for (const [index, clip] of plan.clips.entries()) {
    const asset = assets.get(clip.assetId);
    if (!asset) throw new Error(`Исходник клипа ${index + 1} потерялся.`);
    const file = path.join(jobDir, `clip_${String(index).padStart(3, '0')}.mp4`);
    await renderClip({ clip, asset, frame, file, jobDir, index, plan, signal,
      onProgress: (sec) => report(`Клип ${index + 1} из ${plan.clips.length}`, sec) });
    clipFiles.push(file);
    doneWork += clip.duration;
  }

  const joined = path.join(jobDir, 'joined.mp4');
  await assemble({ plan, clipFiles, joined, jobDir, signal,
    onProgress: (sec) => report('Склейка', sec) });
  doneWork += totalDuration;

  if (plan.music) {
    await mixMusic({ plan, assets, joined, outputPath, totalDuration, signal,
      onProgress: (sec) => report('Сведение звука', sec) });
  } else {
    await fs.rename(joined, outputPath).catch(async () => {
      await fs.copyFile(joined, outputPath);
    });
  }

  if (onProgress) onProgress({ stage: 'Готово', progress: 1 });
  return { path: outputPath, duration: totalDuration };
}

/* ------------------------------ проход 1: клип ----------------------------- */

async function renderClip({ clip, asset, frame, file, jobDir, index, plan, onProgress, signal }) {
  const isImage = clip.kind === 'image';
  const sourceSpan = clip.end - clip.start;
  const outDuration = clip.duration;

  const args = [];
  if (isImage) {
    args.push('-loop', '1', '-t', outDuration.toFixed(3), '-i', asset.storagePath);
  } else {
    args.push('-ss', clip.start.toFixed(3), '-t', sourceSpan.toFixed(3), '-i', asset.storagePath);
  }
  // Второй вход — тишина: гарантирует звуковую дорожку у каждого клипа,
  // без неё склейка разной длины ломается на рассинхроне.
  args.push('-f', 'lavfi', '-t', (outDuration + 0.5).toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');

  const ctx = { ...frame, duration: outDuration };
  const videoSteps = [];

  if (!isImage && clip.speed !== 1) videoSteps.push(`setpts=${(1 / clip.speed).toFixed(6)}*PTS`);
  videoSteps.push(`fps=${frame.fps}`);
  videoSteps.push(...geometrySteps(plan.output.fit, frame));
  videoSteps.push('setsar=1');
  for (const effect of clip.effects) videoSteps.push(...buildEffect(effect, ctx));

  const assName = `clip_${String(index).padStart(3, '0')}.ass`;
  const ass = buildAss(clip.text, frame);
  if (ass) {
    await fs.writeFile(path.join(jobDir, assName), ass, 'utf8');
    // ffmpeg запускается с cwd=jobDir, поэтому имя относительное —
    // так в filtergraph не попадают двоеточия и кавычки из абсолютного пути.
    videoSteps.push(`subtitles=${assName}`);
  }
  videoSteps.push('format=yuv420p');

  const useOriginalAudio = !isImage && asset.hasAudio && plan.audio.keepOriginal && clip.volume > 0;
  const graph = [];

  if (plan.output.fit === 'blur-pad') {
    graph.push(...blurPadGraph('0:v', 'geo', frame, videoSteps));
  } else {
    graph.push(`[0:v]${videoSteps.join(',')}[vout]`);
  }

  if (useOriginalAudio) {
    const audioSteps = ['aresample=48000', ...atempoChain(clip.speed), `volume=${(clip.volume * plan.audio.originalVolume).toFixed(3)}`];
    graph.push(`[0:a]${audioSteps.join(',')},apad[aout]`);
  } else {
    graph.push('[1:a]anull[aout]');
  }

  args.push(
    '-filter_complex', graph.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', outDuration.toFixed(3),
    '-r', String(frame.fps),
    ...VIDEO_ENCODE,
    ...AUDIO_ENCODE,
    '-video_track_timescale', '90000',
    file,
  );

  await runFfmpeg(args, { onProgress, signal, cwd: jobDir });
}

/** Вписывание исходника в кадр: обрезкой, полями или размытым фоном. */
function geometrySteps(fit, frame) {
  const { width: w, height: h } = frame;
  if (fit === 'contain') {
    return [
      `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
    ];
  }
  if (fit === 'blur-pad') return []; // строится отдельным графом
  return [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`];
}

/** Вертикальный кадр из горизонтального исходника: размытая заливка по краям. */
function blurPadGraph(inputLabel, _tag, frame, videoSteps) {
  const { width: w, height: h } = frame;
  const tail = videoSteps.length ? `,${videoSteps.join(',')}` : '';
  return [
    `[${inputLabel}]split=2[bgsrc][fgsrc]`,
    `[bgsrc]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=28,eq=brightness=-0.08[bg]`,
    `[fgsrc]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2${tail}[vout]`,
  ];
}

/** atempo держит 0.5..2.0 за раз, поэтому большие коэффициенты раскладываем. */
function atempoChain(speed) {
  if (!Number.isFinite(speed) || speed === 1) return [];
  const steps = [];
  let remaining = speed;
  while (remaining > 2) { steps.push('atempo=2.0'); remaining /= 2; }
  while (remaining < 0.5) { steps.push('atempo=0.5'); remaining /= 0.5; }
  steps.push(`atempo=${remaining.toFixed(6)}`);
  return steps;
}

/* ---------------------------- проход 2: склейка ---------------------------- */

async function assemble({ plan, clipFiles, joined, jobDir, onProgress, signal }) {
  const needsTransitions = plan.clips.slice(1).some((c) => c.transition.type !== 'cut');

  if (clipFiles.length === 1) {
    await fs.copyFile(clipFiles[0], joined);
    return;
  }

  if (!needsTransitions) {
    // Все клипы уже в одном формате — демуксер склеит их без перекодирования.
    const listFile = path.join(jobDir, 'concat.txt');
    await fs.writeFile(listFile, clipFiles.map((f) => `file '${path.basename(f)}'`).join('\n'), 'utf8');
    await runFfmpeg(
      ['-f', 'concat', '-safe', '0', '-i', path.basename(listFile), '-c', 'copy', '-movflags', '+faststart', joined],
      { onProgress, signal, cwd: jobDir },
    );
    return;
  }

  const args = [];
  for (const file of clipFiles) args.push('-i', file);

  const graph = [];
  let videoLabel = '0:v';
  let audioLabel = '0:a';
  let accumulated = plan.clips[0].duration;

  for (let i = 1; i < clipFiles.length; i += 1) {
    const clip = plan.clips[i];
    const vOut = `v${i}`;
    const aOut = `a${i}`;

    if (clip.transition.type === 'cut') {
      graph.push(`[${videoLabel}][${audioLabel}][${i}:v][${i}:a]concat=n=2:v=1:a=1[${vOut}][${aOut}]`);
      accumulated += clip.duration;
    } else {
      // Переход не должен быть длиннее ни уже собранного куска, ни нового клипа.
      const d = Math.max(0.1, Math.min(clip.transition.duration, accumulated - 0.05, clip.duration - 0.05));
      const offset = Math.max(0, accumulated - d);
      graph.push(`[${videoLabel}][${i}:v]xfade=transition=${clip.transition.type}:duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}[${vOut}]`);
      graph.push(`[${audioLabel}][${i}:a]acrossfade=d=${d.toFixed(3)}:c1=tri:c2=tri[${aOut}]`);
      accumulated += clip.duration - d;
    }
    videoLabel = vOut;
    audioLabel = aOut;
  }

  args.push(
    '-filter_complex', graph.join(';'),
    '-map', `[${videoLabel}]`, '-map', `[${audioLabel}]`,
    '-r', String(plan.output.fps),
    ...VIDEO_ENCODE,
    ...AUDIO_ENCODE,
    '-movflags', '+faststart',
    joined,
  );

  await runFfmpeg(args, { onProgress, signal, cwd: jobDir });
}

/* ----------------------------- проход 3: музыка ---------------------------- */

async function mixMusic({ plan, assets, joined, outputPath, totalDuration, onProgress, signal }) {
  const music = assets.get(plan.music.assetId);
  const { volume, startAt, fadeIn, fadeOut } = plan.music;
  const fadeOutStart = Math.max(0, totalDuration - fadeOut);

  const musicSteps = [
    `atrim=start=${startAt.toFixed(3)}:duration=${totalDuration.toFixed(3)}`,
    'asetpts=PTS-STARTPTS',
    'aresample=48000',
    `volume=${volume.toFixed(3)}`,
  ];
  if (fadeIn > 0) musicSteps.push(`afade=t=in:st=0:d=${fadeIn.toFixed(3)}`);
  if (fadeOut > 0) musicSteps.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`);

  const graph = [
    `[1:a]${musicSteps.join(',')}[music]`,
    plan.music.duckOriginal
      // sidechaincompress приглушает музыку под голос исходника.
      ? `[music][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=15:release=400[ducked];[0:a][ducked]amix=inputs=2:duration=first:normalize=0[aout]`
      : `[0:a][music]amix=inputs=2:duration=first:normalize=0[aout]`,
  ];

  await runFfmpeg(
    [
      '-i', joined,
      '-stream_loop', '-1', '-i', music.storagePath,
      '-filter_complex', graph.join(';'),
      '-map', '0:v', '-map', '[aout]',
      '-c:v', 'copy',
      ...AUDIO_ENCODE,
      '-shortest',
      '-movflags', '+faststart',
      outputPath,
    ],
    { onProgress, signal },
  );
}

export { atempoChain, geometrySteps };
