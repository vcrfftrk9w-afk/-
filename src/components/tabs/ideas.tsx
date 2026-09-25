"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Clapperboard, Clock, Dices, Flame, Lightbulb, Music2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useActions, useBusy } from "@/lib/actions";
import type { VideoIdea } from "@/lib/types";
import { Button, Card, Chip, CopyButton, Empty, SectionHeader, Skeleton, Thinking, cn } from "../ui";
import { useNav } from "../nav";

const EFFORT = { low: { t: "Быстро снять", tone: "lime" }, medium: { t: "Средне", tone: "amber" }, high: { t: "Сложно", tone: "pink" } } as const;

function PotentialRing({ v }: { v: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const color = v >= 80 ? "#fe2c55" : v >= 60 ? "#8b5cf6" : "#14a8a4";
  return (
    <div className="relative size-14 shrink-0" title="Вирусный потенциал">
      <svg viewBox="0 0 48 48" className="size-14 -rotate-90">
        <circle cx="24" cy="24" r={r} stroke="rgba(255,255,255,.08)" strokeWidth="4" fill="none" />
        <motion.circle cx="24" cy="24" r={r} stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * v) / 100 }} transition={{ duration: 1.2 }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold">{v}</div>
    </div>
  );
}

function IdeaCard({ idea, i }: { idea: VideoIdea; i: number }) {
  const { state, update } = useStore();
  const { makeScript } = useActions();
  const { go } = useNav();
  const busy = useBusy(`script:${idea.id}`);
  const hasScript = Boolean(state.scripts[idea.id]);

  const toggleSave = () => update((s) => ({ ideas: s.ideas.map((x) => (x.id === idea.id ? { ...x, saved: !x.saved } : x)) }));
  const remove = () => update((s) => ({ ideas: s.ideas.filter((x) => x.id !== idea.id) }));
  const openScript = async () => {
    if (hasScript) {
      update(() => ({ activeScriptId: idea.id }));
      go("studio");
      return;
    }
    const r = await makeScript(idea);
    if (r) go("studio");
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: Math.min(i * 0.05, 0.4) }} className="glass flex flex-col rounded-3xl p-5">
      <div className="flex items-start gap-4">
        <PotentialRing v={idea.viralPotential} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone={EFFORT[idea.effort]?.tone ?? "default"}>{EFFORT[idea.effort]?.t ?? idea.effort}</Chip>
            <Chip>
              <Clock className="size-3" /> {idea.durationSec}с
            </Chip>
            {idea.trendRef && (
              <Chip tone="pink">
                <Flame className="size-3" /> тренд
              </Chip>
            )}
          </div>
          <div className="mt-2 font-display text-lg font-bold leading-tight">{idea.title}</div>
        </div>
        <button onClick={toggleSave} className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white" title="Сохранить">
          {idea.saved ? <BookmarkCheck className="size-5 text-amber" /> : <Bookmark className="size-5" />}
        </button>
      </div>

      <div className="mt-4 flex items-start justify-between gap-2 rounded-2xl bg-gradient-to-r from-pink/10 to-transparent p-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#ff7a95]">Хук · первые 2 сек</div>
          <div className="mt-1 text-sm font-semibold">«{idea.hook}»</div>
        </div>
        <CopyButton text={idea.hook} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{idea.concept}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/45">
        <span className="text-white/65">Почему сработает:</span> {idea.whyItWillWork}
      </p>
      {idea.sound && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan">
          <Music2 className="size-3.5" /> {idea.sound}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {idea.hashtags.map((h) => (
          <span key={h} className="text-xs text-cyan/80">
            {h}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button size="sm" className="flex-1" onClick={openScript} loading={busy} icon={<Clapperboard className="size-4" />}>
          {hasScript ? "Открыть сценарий" : "Как снять — сценарий"}
        </Button>
        <button onClick={remove} className="rounded-xl p-2 text-white/35 transition hover:bg-white/10 hover:text-pink" title="Удалить">
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}

const QUICK = ["Что снять сегодня за 15 минут", "Идеи без лица в кадре", "Вирусная серия из 5 частей", "Контент, который сохраняют", "Провокация комментариев", "Коллаб с другом"];

export function Ideas() {
  const { state } = useStore();
  const { genIdeas } = useActions();
  const { pendingFocus, clearFocus } = useNav();
  const busy = useBusy("ideas");
  const [focus, setFocus] = useState("");
  const [count, setCount] = useState(6);
  const [view, setView] = useState<"all" | "saved">("all");

  // Переход из «Трендов» с готовым фокусом
  useEffect(() => {
    if (pendingFocus) {
      setFocus(pendingFocus);
      genIdeas({ focus: pendingFocus, count });
      clearFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus]);

  const list = view === "saved" ? state.ideas.filter((i) => i.saved) : state.ideas;

  return (
    <div>
      <SectionHeader icon={<Lightbulb className="size-7 text-amber" />} title="Идеи для видео" subtitle="Персональные идеи с хуком, концептом и прогнозом вирусности — на основе твоих данных и свежих трендов." />

      <Card className="mb-5" glow>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Wand2 className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && genIdeas({ focus, count })}
              placeholder="Что хочешь снять? (необязательно) — например, «танец в школе», «идея на Хэллоуин»"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm outline-none focus:border-pink/60"
            />
          </div>
          <div className="flex gap-2">
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-12 rounded-2xl border border-white/10 bg-black/40 px-3 text-sm outline-none">
              {[3, 6, 9, 12].map((n) => (
                <option key={n} value={n}>
                  {n} идей
                </option>
              ))}
            </select>
            <Button className="h-12 flex-1 lg:flex-none" onClick={() => genIdeas({ focus, count })} loading={busy} icon={<Sparkles className="size-4" />}>
              Придумать
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                setFocus(q);
                genIdeas({ focus: q, count });
              }}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              {q}
            </button>
          ))}
          <button onClick={() => genIdeas({ count })} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/65 hover:bg-white/10 hover:text-white">
            <Dices className="size-3.5" /> Удиви меня
          </button>
        </div>
      </Card>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["all", `Все (${state.ideas.length})`],
            ["saved", `Сохранённые (${state.ideas.filter((i) => i.saved).length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", view === k ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10")}>
            {l}
          </button>
        ))}
      </div>

      {busy && (
        <Card className="mb-5">
          <Thinking lines={["Смотрю, что уже залетало у тебя…", "Подмешиваю свежие тренды…", "Пишу хуки…", "Оцениваю вирусный потенциал…"]} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1].map((k) => (
              <Skeleton key={k} className="h-48" />
            ))}
          </div>
        </Card>
      )}

      {!list.length && !busy ? (
        <Empty
          icon={<Lightbulb className="size-7" />}
          title={view === "saved" ? "Нет сохранённых идей" : "Идей пока нет"}
          text="Нажми «Придумать» — я предложу видео, которые с наибольшей вероятностью залетят именно у тебя."
          action={<Button onClick={() => genIdeas({ count })}>Придумать идеи</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {list.map((idea, i) => (
              <IdeaCard key={idea.id} idea={idea} i={i} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
