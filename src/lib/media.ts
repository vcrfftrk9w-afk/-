"use client";
// Работа с изображениями и видео в браузере: сжатие скриншотов, кадры из видео.

export interface Frame {
  t: number; // секунда видео
  dataUrl: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Не удалось открыть изображение"));
    img.src = src;
  });
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

/** Сжимает изображение до maxDim по длинной стороне и отдаёт JPEG data URL. */
export async function imageToDataURL(file: File, maxDim = 1400, quality = 0.85): Promise<string> {
  const src = await readAsDataURL(file);
  const img = await loadImage(src);
  const k = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

/** Вырезает кадры из видеофайла: хук (первые секунды) + равномерно по ролику. */
export async function extractFrames(file: File, count = 6, maxDim = 720): Promise<{ frames: Frame[]; duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error("Браузер не смог открыть это видео. Попробуй MP4 (H.264)."));
    });
    // Некоторые файлы (например, записанные браузером WebM) не сообщают длительность — вычисляем перемоткой в конец
    if (!isFinite(v.duration) || v.duration <= 0) {
      await new Promise<void>((res) => {
        const done = () => {
          v.removeEventListener("durationchange", done);
          res();
        };
        v.addEventListener("durationchange", done);
        v.currentTime = 1e101;
        setTimeout(done, 4000);
      });
    }
    const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const times = [0.3, Math.min(1.5, d * 0.1), Math.min(3, d * 0.2)];
    const rest = Math.max(0, count - times.length);
    for (let i = 1; i <= rest; i++) times.push((d * (0.25 + (0.7 * i) / rest)) - 0.2);
    const uniq = Array.from(new Set(times.map((t) => Math.max(0, Math.min(d - 0.05, Number(t.toFixed(2))))))).sort((a, b) => a - b);

    const k = Math.min(1, maxDim / Math.max(v.videoWidth || maxDim, v.videoHeight || maxDim));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((v.videoWidth || 720) * k));
    c.height = Math.max(1, Math.round((v.videoHeight || 1280) * k));
    const ctx = c.getContext("2d")!;
    const frames: Frame[] = [];
    for (const t of uniq) {
      await new Promise<void>((res) => {
        const done = () => {
          v.removeEventListener("seeked", done);
          res();
        };
        v.addEventListener("seeked", done);
        v.currentTime = t;
        setTimeout(done, 3000);
      });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      frames.push({ t, dataUrl: c.toDataURL("image/jpeg", 0.8) });
    }
    return { frames, duration: d, width: v.videoWidth, height: v.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataURLToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** «1,2M», «12,3 тыс.», «4.5K», «1 234» → число. */
export function toNum(x: unknown): number {
  if (typeof x === "number") return isFinite(x) ? x : 0;
  if (typeof x !== "string") return 0;
  const s = x.toLowerCase().replace(/\s| /g, "").replace(",", ".");
  const m = s.match(/(-?\d+(?:\.\d+)?)(k|к|тыс\.?|m|м|млн\.?|b|млрд\.?)?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mul = !m[2] ? 1 : /^(k|к|тыс)/.test(m[2]) ? 1e3 : /^(m|м|млн)/.test(m[2]) ? 1e6 : 1e9;
  return Math.round(n * mul);
}
