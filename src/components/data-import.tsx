"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileSpreadsheet, ImagePlus, Loader2, ScanLine, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { imageToDataURL, toNum } from "@/lib/media";
import { importFile, type ImportResult } from "@/lib/importers";
import { extractHashtags, formatNum } from "@/lib/analytics";
import type { ScreensImport } from "@/lib/prompts";
import type { Account, TikTokVideo } from "@/lib/types";
import { Button, cn } from "./ui";
import { toast } from "./toast";

const STEPS = [
  { t: "Профиль", d: "экран своего профиля: видно подписчиков, лайки и сетку роликов с просмотрами" },
  { t: "TikTok Studio → Аналитика → Обзор", d: "итоги за 7 или 28 дней" },
  { t: "TikTok Studio → Аналитика → Контент", d: "список роликов со статистикой; можно 2–3 скрина, пролистывая вниз" },
];

const stripEmpty = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;

/** Убирает дубли роликов (один ролик из файла и со скриншота), оставляя максимум по каждой метрике. */
function dedupe(videos: TikTokVideo[]): TikTokVideo[] {
  const key = (v: TikTokVideo) => (v.shareUrl ? v.shareUrl : v.title ? v.title.toLowerCase().replace(/\s+/g, " ").slice(0, 60) : v.id);
  const m = new Map<string, TikTokVideo>();
  for (const v of videos) {
    const o = m.get(key(v));
    m.set(
      key(v),
      o
        ? { ...o, views: Math.max(o.views, v.views), likes: Math.max(o.likes, v.likes), comments: Math.max(o.comments, v.comments), shares: Math.max(o.shares, v.shares), duration: o.duration || v.duration, createTime: o.createTime || v.createTime }
        : v,
    );
  }
  return [...m.values()];
}

/** Переводит распознанные скриншоты в формат приложения. */
function screensToResult(d: ScreensImport): ImportResult {
  const videos: TikTokVideo[] = (d.videos ?? []).map((v, i) => {
    const title = (v.title ?? "").trim();
    const ts = v.date ? Date.parse(v.date) : NaN;
    return {
      id: `s-${i}-${title.slice(0, 20)}-${toNum(v.views)}`,
      title,
      createTime: isFinite(ts) ? Math.floor(ts / 1000) + 12 * 3600 : 0,
      duration: toNum(v.duration),
      views: toNum(v.views),
      likes: toNum(v.likes),
      comments: toNum(v.comments),
      shares: toNum(v.shares),
      hashtags: extractHashtags(title),
    };
  });
  const p = d.profile ?? ({} as ScreensImport["profile"]);
  const n = (x: number | null | undefined) => (x == null ? undefined : toNum(x));
  return {
    profile: {
      username: p.username?.replace(/^@/, "") || undefined,
      displayName: p.displayName || undefined,
      bio: p.bio ?? undefined,
      followers: n(p.followers),
      following: n(p.following),
      likes: n(p.likes),
      videoCount: n(p.videoCount),
    },
    videos: videos.filter((v) => v.views > 0 || v.likes > 0),
    note: d.notes || "",
  };
}

/** Объединяет новые данные с существующим аккаунтом (или создаёт новый). */
export function mergeImport(prev: Account | null, r: ImportResult, fallbackName = "me"): Account {
  // Демо-данные при загрузке своих полностью заменяются
  const base: Account = prev && prev.source !== "demo" ? prev : {
    source: "import",
    profile: { username: fallbackName, displayName: fallbackName, followers: 0, following: 0, likes: 0, videoCount: 0, bio: "" },
    videos: [],
    connectedAt: Date.now(),
    history: [],
  };
  const clean = Object.fromEntries(Object.entries(r.profile).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const profile = { ...base.profile, ...clean };
  if (!profile.displayName) profile.displayName = profile.username;

  const key = (v: TikTokVideo) => (v.shareUrl ? v.shareUrl : v.title ? v.title.toLowerCase().replace(/\s+/g, " ").slice(0, 60) : v.id);
  const map = new Map(base.videos.map((v) => [key(v), v]));
  for (const v of r.videos) {
    const k = key(v);
    const old = map.get(k);
    map.set(
      k,
      old
        ? {
            ...old,
            views: Math.max(old.views, v.views),
            likes: Math.max(old.likes, v.likes),
            comments: Math.max(old.comments, v.comments),
            shares: Math.max(old.shares, v.shares),
            duration: v.duration || old.duration,
            createTime: v.createTime || old.createTime,
          }
        : v,
    );
  }
  const videos = [...map.values()];
  if (!profile.videoCount || profile.videoCount < videos.length) profile.videoCount = Math.max(profile.videoCount ?? 0, videos.length);

  const history = [...base.history];
  if (profile.followers) history.push({ t: Date.now(), followers: profile.followers, likes: profile.likes ?? 0 });
  return { ...base, source: base.source === "manual" ? "import" : base.source, profile, videos, history: history.slice(-200) };
}

export function DataImport({ onDone, compact }: { onDone: (r: ImportResult) => void; compact?: boolean }) {
  const { status } = useStore();
  const [shots, setShots] = useState<{ name: string; url: string }[]>([]);
  const [busy, setBusy] = useState<"read" | "ai" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const vision = status?.vision !== false && status?.ai;

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const tables = files.filter((f) => !f.type.startsWith("image/"));
    if (tables.length) {
      setBusy("read");
      try {
        let acc: ImportResult = { profile: {}, videos: [], note: "" };
        for (const f of tables) {
          const r = await importFile(f);
          acc = { profile: { ...acc.profile, ...r.profile }, videos: [...acc.videos, ...r.videos], note: [acc.note, r.note].filter(Boolean).join(". ") };
        }
        setResult((prev) => (prev ? { profile: { ...prev.profile, ...acc.profile }, videos: dedupe([...prev.videos, ...acc.videos]), note: acc.note } : { ...acc, videos: dedupe(acc.videos) }));
        setAdding(false);
      } catch (e) {
        toast((e as Error).message, "warn");
      } finally {
        setBusy(null);
      }
    }
    if (images.length) {
      if (!vision) {
        toast("Чтобы читать скриншоты, нужен ИИ. Загрузи файл аналитики из TikTok Studio.", "warn");
        return;
      }
      setBusy("read");
      try {
        const urls = await Promise.all(images.slice(0, 10).map(async (f) => ({ name: f.name, url: await imageToDataURL(f) })));
        setShots((s) => [...s, ...urls].slice(0, 10));
      } catch (e) {
        toast((e as Error).message, "warn");
      } finally {
        setBusy(null);
      }
    }
  }

  async function recognize() {
    if (!shots.length) return;
    setBusy("ai");
    try {
      const res = await fetch("/api/ai/screens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: shots.map((s) => s.url) }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || `Ошибка ${res.status}`);
      const r = screensToResult(j.data as ScreensImport);
      if (!r.profile.followers && !r.videos.length) throw new Error("На скриншотах не нашлось цифр. Сделай скрин профиля и раздела «Аналитика» в TikTok Studio.");
      setResult((prev) => (prev ? { profile: { ...prev.profile, ...stripEmpty(r.profile) }, videos: dedupe([...prev.videos, ...r.videos]), note: r.note } : { ...r, videos: dedupe(r.videos) }));
      setShots([]);
      setAdding(false);
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setBusy(null);
    }
  }

  if (result && !adding) {
    const p = result.profile;
    const top = [...result.videos].sort((a, b) => b.views - a.views).slice(0, 5);
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan">
          <Check className="size-4" /> Нашёл твои данные
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Ник", p.username ? `@${p.username}` : "—"],
            ["Подписчики", p.followers != null ? formatNum(p.followers) : "—"],
            ["Лайки", p.likes != null ? formatNum(p.likes) : "—"],
            ["Видео со статистикой", String(result.videos.length)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-white/40">{l}</div>
              <div className="mt-0.5 truncate font-display text-sm font-bold">{v}</div>
            </div>
          ))}
        </div>
        {top.length > 0 && (
          <div className="mt-3 space-y-1">
            {top.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg bg-black/20 px-3 py-1.5 text-xs">
                <span className="flex-1 truncate text-white/75">{v.title || "Ролик без подписи"}</span>
                <span className="shrink-0 tabular-nums text-white/60">👁 {formatNum(v.views)}</span>
                {v.likes > 0 && <span className="shrink-0 tabular-nums text-white/45">❤️ {formatNum(v.likes)}</span>}
              </div>
            ))}
          </div>
        )}
        {result.note && <p className="mt-3 text-xs text-white/55">{result.note}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onDone(result)} icon={<Check className="size-4" />}>
            Всё верно, дальше
          </Button>
          <Button variant="soft" onClick={() => setAdding(true)}>
            Добавить ещё
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setResult(null);
              setShots([]);
            }}
          >
            Сбросить
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      {result && adding && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-cyan/10 px-3 py-2 text-xs text-cyan">
          <span>Уже найдено: {result.videos.length} видео. Добавь ещё скриншоты или файл.</span>
          <button onClick={() => setAdding(false)} className="font-semibold underline-offset-2 hover:underline">
            Готово
          </button>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition",
          drag ? "border-pink bg-pink/10" : "border-white/15 bg-black/20 hover:border-pink/50 hover:bg-white/[0.03]",
        )}
      >
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink/30 to-violet/30">
          {busy === "read" ? <Loader2 className="size-5 animate-spin" /> : vision ? <ImagePlus className="size-5" /> : <FileSpreadsheet className="size-5" />}
        </div>
        <div className="font-semibold">{vision ? "Перетащи скриншоты TikTok или файл аналитики" : "Перетащи файл аналитики TikTok Studio"}</div>
        <div className="mt-1 text-xs text-white/50">{vision ? "PNG / JPG скриншоты · CSV / XLSX из TikTok Studio · JSON из «Скачать данные»" : "CSV / XLSX из TikTok Studio · JSON из «Скачать данные»"}</div>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={vision ? "image/*,.csv,.xlsx,.xls,.json,.txt" : ".csv,.xlsx,.xls,.json,.txt"}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <AnimatePresence>
        {shots.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {shots.map((s, i) => (
                <div key={i} className="relative h-28 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.name} className="size-full object-cover" />
                  {busy === "ai" && <motion.div className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-cyan/50 to-transparent" animate={{ y: [-24, 112] }} transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.1 }} />}
                  {busy !== "ai" && (
                    <button onClick={() => setShots((xs) => xs.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5" title="Убрать">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button className="mt-3 w-full" onClick={recognize} loading={busy === "ai"} icon={<ScanLine className="size-4" />}>
              {busy === "ai" ? "Читаю цифры со скриншотов…" : `Распознать ${shots.length} скрин.`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!compact && vision && (
        <div className="mt-4 rounded-2xl bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/70">
            <Sparkles className="size-3.5 text-amber" /> Какие скриншоты сделать (чем больше, тем точнее)
          </div>
          <ol className="space-y-1.5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-pink/15 text-[10px] font-bold text-[#ff7a95]">{i + 1}</span>
                <span className="text-white/60">
                  <span className="text-white/85">{s.t}</span> — {s.d}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
