import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic;
export const FFPROBE = process.env.FFPROBE_PATH || ffprobeStatic.path;

class FfmpegError extends Error {
  constructor(message, { args, stderr, code }) {
    super(message);
    this.name = 'FfmpegError';
    this.args = args;
    this.stderr = stderr;
    this.code = code;
  }
}

/**
 * Запускает ffmpeg. onProgress получает секунды, уже записанные в выход —
 * из этого выше по стеку считается процент для SSE.
 */
export function runFfmpeg(args, { onProgress, signal, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], { signal, cwd });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      // ffmpeg болтлив: храним только хвост, его достаточно для диагностики.
      stderr = (stderr + text).slice(-8000);
      if (!onProgress) return;
      for (const m of text.matchAll(/time=(\d+):(\d\d):(\d\d\.\d+)/g)) {
        onProgress(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
      }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new FfmpegError(`ffmpeg завершился с кодом ${code}`, { args, stderr, code }));
    });
  });
}

function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFPROBE, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr = (stderr + c).slice(-4000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new FfmpegError(`ffprobe завершился с кодом ${code}`, { args, stderr, code }));
    });
  });
}

/**
 * Возвращает нормализованные метаданные файла: тип, длительность, размер кадра,
 * повёрнутость, наличие звука. Всё, что нужно планировщику и рендеру.
 */
export async function probe(filePath) {
  const raw = await runFfprobe([
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const data = JSON.parse(raw);
  const streams = data.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');

  const stillImageCodecs = new Set(['mjpeg', 'png', 'bmp', 'webp', 'gif', 'tiff']);
  const formatName = data.format?.format_name || '';
  const durationRaw = Number(data.format?.duration);
  const hasDuration = Number.isFinite(durationRaw) && durationRaw > 0;

  const looksLikeImage =
    !!video &&
    !audio &&
    (stillImageCodecs.has(video.codec_name) || /image2|_pipe/.test(formatName)) &&
    (!hasDuration || durationRaw < 0.5);

  let width = video ? Number(video.width) || 0 : 0;
  let height = video ? Number(video.height) || 0 : 0;
  const rotation = readRotation(video);
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];

  return {
    kind: looksLikeImage ? 'image' : video ? 'video' : audio ? 'audio' : 'unknown',
    duration: hasDuration ? durationRaw : 0,
    width,
    height,
    fps: video ? parseFps(video.avg_frame_rate || video.r_frame_rate) : 0,
    rotation,
    hasAudio: !!audio,
    videoCodec: video?.codec_name || null,
    audioCodec: audio?.codec_name || null,
    sizeBytes: Number(data.format?.size) || 0,
  };
}

function parseFps(value) {
  if (!value) return 0;
  const [num, den] = String(value).split('/').map(Number);
  if (!den) return Number(num) || 0;
  return Number((num / den).toFixed(3)) || 0;
}

function readRotation(stream) {
  if (!stream) return 0;
  const fromTag = Number(stream.tags?.rotate);
  if (Number.isFinite(fromTag) && fromTag) return ((fromTag % 360) + 360) % 360;
  const matrix = (stream.side_data_list || []).find((s) => s.rotation !== undefined);
  if (matrix) return ((Math.round(Number(matrix.rotation)) % 360) + 360) % 360;
  return 0;
}

export { FfmpegError };
