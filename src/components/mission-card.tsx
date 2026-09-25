"use client";
// Миссия дня — главный экран: одно видео и пошаговая инструкция, как его снять и выложить.
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, ChevronDown, Circle, Clock, Film, Megaphone, MessageCircle, Music2, PartyPopper, RefreshCw, Rocket, Scissors, Send, Shuffle, Sparkles, UserRoundPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useActions, useBusy, useMissionControls } from "@/lib/actions";
import type { Mission } from "@/lib/types";
import { Button, Card, Chip, CopyButton, Progress, Skeleton, Thinking, cn } from "./ui";

const KIND: Record<Mission["kind"], string> = {
  starter: "Старт",
  "repeat-best": "Повтор хита",
  trend: "Тренд",
  series: "Серия",
  reply: "Ответ зрителю",
  seed: "Проверенный формат",
};

type StepKey = "prep" | "shoot" | "edit" | "post" | "after";

function Step({
  n,
  k,
  title,
  icon,
  open,
  onOpen,
  done,
  onDone,
  children,
}: {
  n: number;
  k: StepKey;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onOpen: (k: StepKey) => void;
  done: boolean;
  onDone: (k: StepKey) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border transition", done ? "border-cyan/30 bg-cyan/[0.04]" : open ? "border-white/15 bg-white/[0.04]" : "border-white/8 bg-white/[0.02]")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <button onClick={() => onDone(k)} className="shrink-0" title={done ? "Снять отметку" : "Отметить шаг выполненным"}>
          {done ? <CheckCircle2 className="size-7 text-cyan" /> : <Circle className="size-7 text-white/25 hover:text-white/60" />}
        </button>
        <button onClick={() => onOpen(k)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", done ? "bg-cyan/15 text-cyan" : "bg-gradient-to-br from-pink/30 to-violet/30")}>{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Шаг {n}</span>
            <span className={cn("block font-semibold", done && "text-white/55 line-through")}>{title}</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-white/40 transition", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t border-white/5 px-4 pb-4 pt-3 text-sm">
              {children}
              {!done && (
                <Button size="sm" variant="soft" className="mt-4" onClick={() => onDone(k)} icon={<CheckCircle2 className="size-4" />}>
                  Готово, дальше
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">
    {items.map((x, i) => (
      <li key={i} className="flex gap-2.5 text-white/80">
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pink" />
        <span>{x}</span>
      </li>
    ))}
  </ul>
);

export function MissionCard() {
  const { state, status } = useStore();
  const { newMission, refreshAccount } = useActions();
  const { toggleStep, complete } = useMissionControls();
  const busy = useBusy("mission");
  const refreshing = useBusy("refresh");
  const m = state.mission;
  const started = useRef(false);
  const order: StepKey[] = ["prep", "shoot", "edit", "post", "after"];
  const [open, setOpen] = useState<StepKey | null>(null);

  // Первая миссия появляется сама
  useEffect(() => {
    if (started.current || m || !status) return;
    started.current = true;
    newMission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, status]);

  // Открываем первый невыполненный шаг
  useEffect(() => {
    if (!m) return;
    setOpen(order.find((k) => !m.doneSteps?.[k]) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  if (!m) {
    return (
      <Card glow>
        <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Rocket className="size-5 text-pink" /> Готовлю твою миссию на сегодня
        </div>
        <Thinking lines={["Смотрю, что ты уже снимаешь…", "Ищу, что у тебя сработало…", "Подбираю идею и тренд…", "Расписываю по секундам…"]} />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </Card>
    );
  }

  const doneCount = order.filter((k) => m.doneSteps?.[k]).length;
  const onDone = (k: StepKey) => {
    const wasDone = !!m.doneSteps?.[k];
    toggleStep(k);
    if (!wasDone) {
      const next = order.find((x) => x !== k && !m.doneSteps?.[x]);
      setOpen(next ?? null);
    }
  };
  const onOpen = (k: StepKey) => setOpen((o) => (o === k ? null : k));
  const fullCaption = `${m.caption}\n\n${m.hashtags.join(" ")}`;

  if (m.completedAt) {
    return (
      <Card glow className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-lime/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-lime/40 to-cyan/30">
            <PartyPopper className="size-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-lime">Миссия №{m.number} выполнена</div>
            <div className="mt-1 font-display text-xl font-bold">{m.title}</div>
            <p className="mt-1 text-sm text-white/60">
              Сейчас: отвечай на комментарии первый час. Завтра нажми «Обновить данные» — я посмотрю, как зашёл ролик, и дам следующую миссию.
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button onClick={() => newMission()} loading={busy} icon={<Rocket className="size-4" />}>
            Следующая миссия
          </Button>
          <Button variant="soft" onClick={() => refreshAccount()} loading={refreshing} icon={<RefreshCw className="size-4" />}>
            Обновить данные из TikTok
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card glow className="relative overflow-hidden p-0">
      <div className="absolute -left-20 -top-24 size-72 rounded-full bg-pink/15 blur-3xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="pink">
            <Rocket className="size-3" /> Миссия дня №{m.number}
          </Chip>
          <Chip tone="violet">{KIND[m.kind]}</Chip>
          <Chip>
            <Clock className="size-3" /> ~{m.durationSec} с
          </Chip>
          <Chip tone={m.source === "ai" ? "lime" : "default"}>{m.source === "ai" ? "Составил ИИ" : "Офлайн-движок"}</Chip>
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-[28px]">{m.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">{m.why}</p>
        {m.basedOn && <p className="mt-2 text-xs text-cyan">↳ {m.basedOn}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="flex items-start justify-between gap-2 rounded-2xl bg-gradient-to-br from-pink/15 to-violet/10 p-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#ff7a95]">Первые 2 секунды — скажи/покажи</div>
              <div className="mt-1 font-semibold">«{m.hook}»</div>
            </div>
            <CopyButton text={m.hook} />
          </div>
          <div className="flex items-start justify-between gap-2 rounded-2xl bg-white/[0.04] p-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber">Текст крупно в первом кадре</div>
              <div className="mt-1 font-semibold">{m.onScreenText}</div>
            </div>
            <CopyButton text={m.onScreenText} />
          </div>
        </div>

        {m.bonus?.length ? (
          <div className="mt-3 rounded-2xl border border-amber/25 bg-amber/[0.06] p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-semibold text-amber">
              <UserRoundPen className="size-4" /> Сначала за 2 минуты
            </div>
            <Bullets items={m.bonus} />
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <Progress value={(doneCount / order.length) * 100} className="h-2" />
          <span className="shrink-0 text-xs font-semibold text-white/60">
            {doneCount}/{order.length}
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          <Step n={1} k="prep" title="Подготовка (3 минуты)" icon={<Camera className="size-4" />} open={open === "prep"} onOpen={onOpen} done={!!m.doneSteps?.prep} onDone={onDone}>
            <Bullets items={m.prep} />
          </Step>

          <Step n={2} k="shoot" title="Снимаем по кадрам" icon={<Film className="size-4" />} open={open === "shoot"} onOpen={onOpen} done={!!m.doneSteps?.shoot} onDone={onDone}>
            <div className="relative space-y-3 pl-5">
              <div className="absolute bottom-1 left-[5px] top-1 w-px bg-gradient-to-b from-cyan via-violet to-pink" />
              {m.shots.map((s, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-5 top-1.5 size-2.5 rounded-full bg-gradient-to-br from-cyan to-pink" />
                  <span className="mr-2 rounded-md bg-white/10 px-1.5 py-0.5 font-display text-xs font-bold">{s.t}</span>
                  <span className="text-white/85">{s.what}</span>
                  {s.say ? <div className="mt-1 text-xs text-cyan">🗣 «{s.say}»</div> : null}
                </div>
              ))}
            </div>
          </Step>

          <Step n={3} k="edit" title="Монтаж (10 минут)" icon={<Scissors className="size-4" />} open={open === "edit"} onOpen={onOpen} done={!!m.doneSteps?.edit} onDone={onDone}>
            <Bullets items={m.edit} />
            <div className="mt-3 flex items-center gap-2 text-xs text-cyan">
              <Music2 className="size-3.5 shrink-0" /> {m.sound}
            </div>
          </Step>

          <Step n={4} k="post" title={`Публикация · ${m.postAt}`} icon={<Send className="size-4" />} open={open === "post"} onOpen={onOpen} done={!!m.doneSteps?.post} onDone={onDone}>
            <div className="rounded-2xl bg-black/25 p-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                Подпись + хэштеги — скопируй целиком <CopyButton text={fullCaption} />
              </div>
              <p className="whitespace-pre-line text-white/85">{m.caption}</p>
              <p className="mt-2 text-cyan">{m.hashtags.join(" ")}</p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-white/70">
              <Clock className="size-4 text-amber" /> Выложить: <span className="font-semibold text-white">{m.postAt}</span>
            </div>
          </Step>

          <Step n={5} k="after" title="Первый час после публикации" icon={<MessageCircle className="size-4" />} open={open === "after"} onOpen={onOpen} done={!!m.doneSteps?.after} onDone={onDone}>
            <Bullets items={m.afterPost} />
          </Step>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={complete} icon={<Megaphone className="size-4" />} className={cn(doneCount >= 4 && "animate-pulse")}>
            Я снял(а) и выложил(а)!
          </Button>
          <Button variant="ghost" onClick={() => newMission(Math.floor(Math.random() * 5) + 1)} loading={busy} icon={<Shuffle className="size-4" />}>
            Другая идея
          </Button>
          {status?.ai === false && (
            <span className="flex items-center gap-1.5 self-center text-xs text-white/40">
              <Sparkles className="size-3.5" /> С ИИ миссии будут ещё точнее
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
