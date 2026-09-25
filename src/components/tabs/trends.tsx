"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clapperboard, ExternalLink, Flame, Globe, Hash, Lightbulb, Music2, RefreshCw, Search, Sparkles, Wand2, Laugh, Trophy, Film } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useActions, useBusy } from "@/lib/actions";
import type { Trend, VideoIdea } from "@/lib/types";
import { Button, Card, Chip, CopyButton, Empty, Progress, SectionHeader, Skeleton, Thinking, cn } from "../ui";
import { useNav } from "../nav";

const TYPE: Record<Trend["type"], { label: string; icon: typeof Music2 }> = {
  sound: { label: "Звук", icon: Music2 },
  format: { label: "Формат", icon: Film },
  hashtag: { label: "Хэштег", icon: Hash },
  challenge: { label: "Челлендж", icon: Trophy },
  effect: { label: "Эффект", icon: Wand2 },
  meme: { label: "Мем", icon: Laugh },
};
const LIFE = {
  rising: { t: "Растёт 📈", tone: "lime" },
  peak: { t: "На пике 🔥", tone: "pink" },
  fading: { t: "Угасает", tone: "default" },
  evergreen: { t: "Вечный", tone: "cyan" },
} as const;
const DIFF = { easy: "Легко", medium: "Средне", hard: "Сложно" };

function TrendCard({ t, i }: { t: Trend; i: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { update } = useStore();
  const { makeScript } = useActions();
  const { go } = useNav();
  const T = TYPE[t.type] ?? TYPE.format;

  const toScript = async () => {
    const idea: VideoIdea = {
      id: Math.random().toString(36).slice(2, 10),
      title: t.exampleIdea.replace(/^[^\p{L}\p{N}]+/u, "") || t.name,
      hook: t.howToShoot[0] ?? t.name,
      concept: `${t.description} ${t.exampleIdea}`,
      format: t.name,
      trendRef: t.name,
      viralPotential: Math.round((t.heat + t.nicheFit) / 2),
      effort: t.difficulty === "easy" ? "low" : t.difficulty === "medium" ? "medium" : "high",
      durationSec: 15,
      whyItWillWork: t.whyItWorks,
      hashtags: t.hashtags,
      sound: t.sound,
      saved: true,
    };
    update((s) => ({ ideas: [idea, ...s.ideas] }));
    setLoading(true);
    const r = await makeScript(idea);
    setLoading(false);
    if (r) go("studio");
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="glass overflow-hidden rounded-3xl">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-5 text-left">
        <div className="flex items-start gap-4">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink/30 to-violet/20">
            <T.icon className="size-5" />
            {t.heat >= 80 && <span className="absolute -right-1 -top-1 text-sm">🔥</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip>{T.label}</Chip>
              <Chip tone={LIFE[t.lifecycle]?.tone ?? "default"}>{LIFE[t.lifecycle]?.t ?? t.lifecycle}</Chip>
              <Chip tone="violet">Подходит на {t.nicheFit}%</Chip>
            </div>
            <div className="mt-2 font-display text-lg font-bold leading-tight">{t.name}</div>
            <div className="mt-1 line-clamp-2 text-sm text-white/55">{t.description}</div>
            {t.sound && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan">
                <Music2 className="size-3.5" /> {t.sound}
              </div>
            )}
          </div>
          <ChevronDown className={cn("size-5 shrink-0 text-white/40 transition", open && "rotate-180")} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Flame className="size-4 text-pink" />
          <Progress value={t.heat} tone="pink" className="h-1.5 flex-1" />
          <span className="w-8 text-right text-xs font-bold">{t.heat}</span>
          <span className="text-xs text-white/40">· {DIFF[t.difficulty]}</span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="space-y-4 border-t border-white/5 p-5">
              <div className="rounded-2xl bg-white/[0.03] p-3 text-sm text-white/70">
                <span className="font-semibold text-white">Почему работает: </span>
                {t.whyItWorks}
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Clapperboard className="size-4 text-pink" /> Как снять — пошагово
                </div>
                <ol className="space-y-2.5">
                  {t.howToShoot.map((s, k) => (
                    <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.05 }} className="flex gap-3 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-pink/15 text-xs font-bold text-[#ff7a95]">{k + 1}</span>
                      <span className="pt-0.5 text-white/80">{s}</span>
                    </motion.li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-amber/20 bg-amber/5 p-3 text-sm">
                <span className="font-semibold text-amber">💡 Идея для тебя: </span>
                <span className="text-white/80">{t.exampleIdea}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {t.hashtags.map((h) => (
                    <Chip key={h} tone="cyan">
                      {h}
                    </Chip>
                  ))}
                </div>
                <CopyButton text={t.hashtags.join(" ")} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={toScript} loading={loading} icon={<Clapperboard className="size-4" />}>
                  Сценарий по тренду
                </Button>
                <Button size="sm" variant="soft" onClick={() => go("ideas", { focus: `Используй тренд «${t.name}»${t.sound ? ` (звук: ${t.sound})` : ""}` })} icon={<Lightbulb className="size-4" />}>
                  Ещё идеи на этом тренде
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Trends() {
  const { state, status } = useStore();
  const { fetchTrends } = useActions();
  const busy = useBusy("trends");
  const [focus, setFocus] = useState("");
  const [filter, setFilter] = useState<Trend["type"] | "all">("all");
  const tr = state.trends;
  const list = (tr?.trends ?? []).filter((t) => filter === "all" || t.type === filter);
  const types = Array.from(new Set((tr?.trends ?? []).map((t) => t.type)));
  const sources = tr?.trends[0]?.sources ?? [];

  return (
    <div>
      <SectionHeader
        icon={<Flame className="size-7 text-pink" />}
        title="Тренды"
        subtitle={
          status?.ai
            ? status.webSearch === false
              ? "ИИ подбирает тренды и форматы под твою нишу и объясняет, как их снять."
              : "AI ищет в интернете, что залетает прямо сейчас в твоей нише, и объясняет, как это снять."
            : "Проверенные форматы для твоей ниши. Подключи AI-ключ, чтобы искать свежие тренды в интернете."
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchTrends(focus)}
              placeholder="Уточни, что ищем: «звуки для переходов», «k-pop челленджи», «тренды недели»…"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm outline-none focus:border-pink/60"
            />
          </div>
          <Button className="h-12" onClick={() => fetchTrends(focus)} loading={busy} icon={status?.ai && status.webSearch !== false ? <Globe className="size-4" /> : <RefreshCw className="size-4" />}>
            {status?.ai ? (status.webSearch === false ? "Подобрать тренды" : "Искать в интернете") : "Обновить"}
          </Button>
        </div>
        {tr && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
            {tr.live || tr.origin === "web" ? (
              <Chip tone="lime">● LIVE · найдено в интернете</Chip>
            ) : tr.origin === "ai" ? (
              <Chip tone="violet">Подбор ИИ</Chip>
            ) : (
              <Chip>Офлайн-база</Chip>
            )}
            <span>обновлено {new Date(tr.fetchedAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
        {tr?.note && <p className="mt-3 text-sm text-white/65">{tr.note}</p>}
      </Card>

      {busy && (
        <Card className="mb-5">
          <Thinking lines={status?.ai ? ["Ищу свежие тренды TikTok…", "Смотрю Creative Center и блоги…", "Фильтрую под твою нишу…", "Пишу инструкции по съёмке…"] : ["Подбираю форматы…"]} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-36" />
            ))}
          </div>
        </Card>
      )}

      {!tr && !busy && (
        <Empty icon={<Sparkles className="size-7" />} title="Трендов пока нет" text="Запусти поиск — найду то, что залетает в твоей нише." action={<Button onClick={() => fetchTrends()}>Найти тренды</Button>} />
      )}

      {tr && (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
            {(["all", ...types] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition", filter === t ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10")}
              >
                {t === "all" ? "Все" : TYPE[t]?.label ?? t}
              </button>
            ))}
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {list.map((t, i) => (
              <TrendCard key={t.id} t={t} i={i} />
            ))}
          </div>
          {sources.length > 0 && (
            <Card className="mt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Globe className="size-4 text-cyan" /> Источники
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/60 hover:text-white">
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{s.title || s.url}</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
