"use client";
// Импорт реальных данных из файлов TikTok:
//  • экспорт аналитики TikTok Studio (CSV / XLSX);
//  • архив «Скачать данные» из настроек TikTok (JSON).
import type { TikTokProfile, TikTokVideo } from "./types";
import { extractHashtags } from "./analytics";
import { toNum } from "./media";

export interface ImportResult {
  profile: Partial<TikTokProfile>;
  videos: TikTokVideo[];
  note: string;
}

// ── CSV ─────────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ── XLSX (SheetJS грузится с CDN только при необходимости) ──────────────────
type XLSXLib = {
  read(data: ArrayBuffer, o: { type: "array"; cellDates?: boolean }): { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json(s: unknown, o: { header: 1; raw: false; defval: string }): string[][] };
};
let xlsxPromise: Promise<XLSXLib> | null = null;
function loadXLSX(): Promise<XLSXLib> {
  const w = window as unknown as { XLSX?: XLSXLib };
  if (w.XLSX) return Promise.resolve(w.XLSX);
  xlsxPromise ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => (w.XLSX ? res(w.XLSX) : rej(new Error("Не удалось загрузить чтение Excel")));
    s.onerror = () => rej(new Error("Не удалось загрузить чтение Excel. Сохрани файл как CSV."));
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

// ── Сопоставление колонок ───────────────────────────────────────────────────
const COLS: Record<keyof Pick<TikTokVideo, "title" | "views" | "likes" | "comments" | "shares" | "duration" | "createTime" | "shareUrl">, RegExp> = {
  title: /(video title|title|caption|description|назван|описан|подпис|видео$)/i,
  views: /(views|plays|просмотр|воспроизвед)/i,
  likes: /(likes|лайк|нрав)/i,
  comments: /(comments|коммент)/i,
  shares: /(shares|репост|поделил)/i,
  duration: /(duration|длительн|length)/i,
  createTime: /(post time|posted|date|time|дата|опублик|врем)/i,
  shareUrl: /(link|url|ссылк)/i,
};

function parseDate(s: string): number {
  if (!s) return 0;
  const n = Number(s);
  if (isFinite(n) && n > 1e9) return n > 1e12 ? Math.floor(n / 1000) : n;
  const ru = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (ru) {
    const y = Number(ru[3].length === 2 ? `20${ru[3]}` : ru[3]);
    return Math.floor(new Date(y, Number(ru[2]) - 1, Number(ru[1]), Number(ru[4] ?? 12), Number(ru[5] ?? 0)).getTime() / 1000);
  }
  const t = Date.parse(s.replace(" UTC", "Z"));
  return isFinite(t) ? Math.floor(t / 1000) : 0;
}

function rowsToVideos(rows: string[][]): TikTokVideo[] {
  // Ищем строку заголовков: первая, где найдено ≥2 известных колонки
  let h = -1;
  let map: Partial<Record<keyof typeof COLS, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const m: typeof map = {};
    rows[i].forEach((cell, j) => {
      for (const [k, re] of Object.entries(COLS) as [keyof typeof COLS, RegExp][]) {
        if (m[k] === undefined && re.test(cell)) m[k] = j;
      }
    });
    if (Object.keys(m).length >= 2 && m.views !== undefined) {
      h = i;
      map = m;
      break;
    }
  }
  if (h < 0) return [];
  const now = Math.floor(Date.now() / 1000);
  return rows
    .slice(h + 1)
    .map((r, i) => {
      const get = (k: keyof typeof COLS) => (map[k] !== undefined ? String(r[map[k]!] ?? "") : "");
      const title = get("title");
      return {
        id: `f-${i}-${get("shareUrl").split("/").pop() || i}`,
        title,
        shareUrl: get("shareUrl") || undefined,
        createTime: parseDate(get("createTime")) || now - i * 86400,
        duration: toNum(get("duration")) || 0,
        views: toNum(get("views")),
        likes: toNum(get("likes")),
        comments: toNum(get("comments")),
        shares: toNum(get("shares")),
        hashtags: extractHashtags(title),
      };
    })
    .filter((v) => v.views > 0 || v.likes > 0);
}

// ── JSON-архив TikTok («Скачать данные») ────────────────────────────────────
function walk(o: unknown, fn: (k: string, v: unknown) => void, depth = 0) {
  if (!o || typeof o !== "object" || depth > 8) return;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    fn(k, v);
    walk(v, fn, depth + 1);
  }
}

function fromExportJSON(data: unknown): ImportResult {
  const profile: Partial<TikTokProfile> = {};
  const videos: TikTokVideo[] = [];
  walk(data, (k, v) => {
    const key = k.toLowerCase();
    if (key === "username" && typeof v === "string") profile.username ??= v;
    if ((key === "biodescription" || key === "bio") && typeof v === "string") profile.bio ??= v;
    if ((key === "likesreceived" || key === "likes_received") && v != null) profile.likes ??= toNum(String(v));
    if ((key === "followercount" || key === "followers") && v != null && typeof v !== "object") profile.followers ??= toNum(String(v));
    if (key === "videolist" && Array.isArray(v)) {
      v.forEach((it: Record<string, unknown>, i) => {
        const link = String(it.Link ?? it.link ?? "");
        const title = String(it.Title ?? it.title ?? it.Desc ?? "");
        videos.push({
          id: `j-${link.split("/").filter(Boolean).pop() ?? i}`,
          title,
          shareUrl: link || undefined,
          createTime: parseDate(String(it.Date ?? it.date ?? "")),
          duration: 0,
          views: toNum(String(it.Views ?? it.views ?? it.PlayCount ?? 0)),
          likes: toNum(String(it.Likes ?? it.likes ?? 0)),
          comments: toNum(String(it.Comments ?? it.comments ?? 0)),
          shares: toNum(String(it.Shares ?? it.shares ?? 0)),
          hashtags: extractHashtags(title),
        });
      });
    }
  });
  const hasViews = videos.some((v) => v.views > 0);
  return {
    profile,
    videos,
    note: videos.length
      ? `Из архива: ${videos.length} видео${hasViews ? "" : " (в архиве TikTok нет просмотров — добавь скриншоты или файл из TikTok Studio для точной аналитики)"}`
      : "В архиве не нашлось списка видео",
  };
}

/** Главная функция: читает файл и возвращает найденные данные. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || file.type === "application/json") {
    return fromExportJSON(JSON.parse(await file.text()));
  }
  let rows: string[][];
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: "array" });
    rows = [];
    let best: string[][] = [];
    for (const sn of wb.SheetNames) {
      const r = X.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: "" });
      if (rowsToVideos(r).length > rowsToVideos(best).length) best = r;
    }
    rows = best;
  } else if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.startsWith("text/")) {
    rows = parseCSV(await file.text());
  } else if (name.endsWith(".zip")) {
    throw new Error("Распакуй архив и загрузи файл user_data_tiktok.json из него");
  } else {
    throw new Error("Поддерживаются CSV, XLSX и JSON");
  }
  const videos = rowsToVideos(rows);
  if (!videos.length) throw new Error("В файле не нашлось колонок с просмотрами. Загрузи экспорт «Контент» из TikTok Studio или скриншоты.");
  return { profile: {}, videos, note: `Из файла: ${videos.length} видео со статистикой` };
}
