"use client";
import { motion } from "framer-motion";
import { Film, FileText, Hash, Link2, ListVideo, Loader2, MessageSquareQuote, PenLine, ScanSearch, Sparkles, UserRound, Wand2, X } from "lucide-react";
import { extractFrames, type Frame } from "@/lib/media";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { callAI, getJSON } from "@/lib/api";
import { Button, Card, Chip, CopyButton, Progress, ScoreRing, SectionHeader, Thinking, cn } from "../ui";
import { toast } from "../toast";

const TOOLS = [
  { id: "hooks", label: "Хуки", icon: MessageSquareQuote, hint: "Тема ролика", ph: "например: утренняя рутина, танец на выпускном" },
  { id: "captions", label: "Подписи", icon: FileText, hint: "О чём видео", ph: "например: пробую вирусный рецепт" },
  { id: "hashtags", label: "Хэштеги", icon: Hash, hint: "Тема", ph: "например: k-pop кавер" },
  { id: "bio", label: "Био профиля", icon: UserRound, hint: "Кто ты и о чём контент", ph: "например: танцую каждый день, учу трендам" },
  { id: "rewrite", label: "Улучшить текст", icon: PenLine, hint: "Вставь свой сценарий/текст", ph: "Вставь текст, который скажешь в ролике…" },
  { id: "names", label: "Названия серий", icon: ListVideo, hint: "Тема рубрики", ph: "например: разборы ошибок новичков" },
] as const;

interface ReviewResult {
  score: number;
  verdict: string;
  scores: { name: string; score: number; comment: string }[];
  improvements: string[];
  betterHooks: string[];
  betterCaption: string;
  hashtags: string[];
}

function Generator() {
  const { state } = useStore();
  const [tool, setTool] = useState<(typeof TOOLS)[number]["id"]>("hooks");
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const T = TOOLS.find((t) => t.id === tool)!;

  async function run() {
    setLoading(true);
    try {
      const r = await callAI<string[]>("tool", { settings: state.settings!, account: state.account, tool, topic });
      setItems(r.data);
      if (r.warning) toast(r.warning, "warn");
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card glow>
      <div className="mb-4 flex items-center gap-2 font-display font-bold">
        <Wand2 className="size-5 text-pink" /> Генератор
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTool(t.id);
              setItems([]);
            }}
            className={cn("flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition", tool === t.id ? "bg-white text-black" : "bg-white/5 text-white/65 hover:bg-white/10")}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      <label className="text-xs text-white/50">{T.hint}</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        {tool === "rewrite" ? (
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} placeholder={T.ph} className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-pink/60" />
        ) : (
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={T.ph}
            className="h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-pink/60"
          />
        )}
        <Button className="h-12" onClick={run} loading={loading} icon={<Sparkles className="size-4" />}>
          Сгенерировать
        </Button>
      </div>
      {items.length > 0 && (
        <div className="mt-5 space-y-2">
          {items.map((it, i) => (
            <motion.div key={`${tool}-${i}-${it.slice(0, 10)}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex items-start justify-between gap-3 rounded-2xl bg-white/[0.03] p-3">
              <span className="whitespace-pre-line text-sm text-white/85">{it}</span>
              <CopyButton text={it} />
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Reviewer() {
  const { state } = useStore();
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [stats, setStats] = useState({ views: "", likes: "", comments: "", shares: "", duration: "" });
  const [meta, setMeta] = useState<{ title: string; author: string; thumbnail: string } | null>(null);
  const [res, setRes] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [video, setVideo] = useState<{ name: string; frames: Frame[]; duration: number } | null>(null);
  const [cutting, setCutting] = useState(false);
  const { status } = useStore();

  async function pickVideo(f: File) {
    setCutting(true);
    setRes(null);
    try {
      const r = await extractFrames(f, 7);
      setVideo({ name: f.name, frames: r.frames, duration: r.duration });
      setStats((s) => ({ ...s, duration: s.duration || String(Math.round(r.duration)) }));
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setCutting(false);
    }
  }

  async function run() {
    setLoading(true);
    setRes(null);
    try {
      let m = meta;
      if (url.trim() && !m) {
        try {
          m = await getJSON<{ title: string; author: string; thumbnail: string }>(`/api/tiktok/oembed?url=${encodeURIComponent(url.trim())}`);
          setMeta(m);
        } catch (e) {
          toast(`Ссылка: ${(e as Error).message}. Разберу по описанию.`, "warn");
        }
      }
      if (!desc.trim() && !m && !video) {
        toast("Загрузи видео, вставь ссылку или опиши ролик", "warn");
        return;
      }
      const num = (s: string) => (s ? Number(s) : undefined);
      const st = { views: num(stats.views), likes: num(stats.likes), comments: num(stats.comments), shares: num(stats.shares), duration: num(stats.duration) };
      const hasStats = Object.values(st).some((v) => v !== undefined);
      const r = await callAI<ReviewResult>("review", { settings: state.settings!, account: state.account, description: desc, meta: m ?? undefined, stats: hasStats ? st : undefined, frames: video?.frames, duration: video?.duration });
      setRes(r.data);
      if (r.warning) toast(r.warning, "warn");
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2 font-display font-bold">
        <ScanSearch className="size-5 text-cyan" /> Разбор ролика
      </div>
      <p className="mb-4 text-xs text-white/50">
        {status?.vision ? "Загрузи сам ролик — я посмотрю кадры хука и всего видео и скажу, что переснять. Можно и просто описать идею до съёмки." : "Вставь ссылку на своё видео и/или опиши идею до съёмки — оценю потенциал и скажу, что поменять."}
      </p>
      <div className="space-y-3">
        {status?.vision && (
          <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition", video ? "border-cyan/40 bg-cyan/5" : "border-white/15 bg-black/20 hover:border-pink/50")}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink/30 to-violet/30">
              {cutting ? <Loader2 className="size-5 animate-spin" /> : <Film className="size-5" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-semibold">{video ? video.name : "Загрузить видео (MP4, MOV)"}</div>
              <div className="text-xs text-white/50">{video ? `${Math.round(video.duration)} с · ${video.frames.length} кадров для разбора` : "Видео не покидает браузер — ИИ получает только кадры"}</div>
            </div>
            {video && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setVideo(null);
                }}
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                title="Убрать видео"
              >
                <X className="size-4" />
              </button>
            )}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickVideo(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {video && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {video.frames.map((f) => (
              <div key={f.t} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.dataUrl} alt={`кадр ${f.t.toFixed(1)} с`} className="h-24 w-auto rounded-lg object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] tabular-nums">{f.t.toFixed(1)}с</span>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Link2 className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setMeta(null);
            }}
            placeholder="https://www.tiktok.com/@user/video/…"
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm outline-none focus:border-cyan/60"
          />
        </div>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Опиши ролик: что в первые секунды, что происходит, чем заканчивается, подпись…" className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-cyan/60" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(
            [
              ["views", "Просмотры"],
              ["likes", "Лайки"],
              ["comments", "Комменты"],
              ["shares", "Репосты"],
              ["duration", "Длит., с"],
            ] as const
          ).map(([k, l]) => (
            <input key={k} inputMode="numeric" value={stats[k]} onChange={(e) => setStats((s) => ({ ...s, [k]: e.target.value.replace(/\D/g, "") }))} placeholder={l} className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-xs outline-none focus:border-cyan/60" />
          ))}
        </div>
        <Button onClick={run} loading={loading} className="w-full" icon={<ScanSearch className="size-4" />}>
          Разобрать
        </Button>
      </div>

      {loading && (
        <div className="mt-5">
          <Thinking lines={["Смотрю на хук…", "Оцениваю удержание…", "Проверяю SEO…", "Пишу правки…"]} />
        </div>
      )}

      {meta && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
          {meta.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.thumbnail} alt="" className="h-16 w-12 rounded-lg object-cover" />
          )}
          <div className="min-w-0 text-sm">
            <div className="font-semibold">@{meta.author}</div>
            <div className="line-clamp-2 text-white/60">{meta.title}</div>
          </div>
        </div>
      )}

      {res && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <ScoreRing score={res.score} size={140} label="Потенциал" />
            <p className="flex-1 text-sm leading-relaxed text-white/80">{res.verdict}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.scores.map((s) => (
              <div key={s.name} className="rounded-2xl bg-white/[0.03] p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <span className="font-display font-bold">{s.score}</span>
                </div>
                <Progress value={s.score} className="my-2 h-1.5" />
                <div className="text-xs text-white/55">{s.comment}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Что изменить</div>
            <ol className="space-y-2">
              {res.improvements.map((x, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-cyan/15 text-xs font-bold text-cyan">{i + 1}</span>
                  <span className="pt-0.5 text-white/80">{x}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Хуки сильнее</div>
            <div className="space-y-2">
              {res.betterHooks.map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded-2xl bg-pink/5 p-3 text-sm">
                  <span>«{h}»</span>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] p-3">
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
              Подпись <CopyButton text={`${res.betterCaption} ${res.hashtags.join(" ")}`} />
            </div>
            <div className="text-sm">{res.betterCaption}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {res.hashtags.map((h) => (
                <Chip key={h} tone="cyan">
                  {h}
                </Chip>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

export function Tools() {
  return (
    <div>
      <SectionHeader icon={<Wand2 className="size-7 text-violet" />} title="Инструменты" subtitle="Хуки, подписи, хэштеги, био и разбор роликов за секунды." />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Generator />
        <Reviewer />
      </div>
    </div>
  );
}
