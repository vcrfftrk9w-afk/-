"use client";
import { motion } from "framer-motion";
import { BookOpen, Camera, CheckCircle2, Circle, MessagesSquare, Radio, RefreshCw, Send, Settings2, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { planDayIndex, useActions, useBusy, useToggleTask } from "@/lib/actions";
import type { PlanTask } from "@/lib/types";
import { Button, Card, Chip, Empty, Progress, SectionHeader, Thinking, cn } from "../ui";

const KIND: Record<PlanTask["kind"], { icon: typeof Camera; label: string; cls: string }> = {
  film: { icon: Camera, label: "Съёмка", cls: "text-pink" },
  post: { icon: Send, label: "Публикация", cls: "text-cyan" },
  engage: { icon: MessagesSquare, label: "Вовлечение", cls: "text-lime" },
  learn: { icon: BookOpen, label: "Учёба", cls: "text-amber" },
  optimize: { icon: Settings2, label: "Оптимизация", cls: "text-violet" },
  live: { icon: Radio, label: "Эфир", cls: "text-pink" },
};

export function Plan() {
  const { state } = useStore();
  const { makePlan } = useActions();
  const toggle = useToggleTask();
  const busy = useBusy("plan");
  const plan = state.plan;
  const todayIdx = plan ? planDayIndex(plan) : 0;
  const [sel, setSel] = useState(todayIdx);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSel(todayIdx);
    const el = stripRef.current?.children[todayIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [todayIdx, plan?.createdAt]);

  if (!plan) {
    return (
      <div>
        <SectionHeader icon={<Target className="size-7 text-lime" />} title="План роста" subtitle="Персональная программа на 30 дней: каждый день — что снимать, когда выкладывать и как вовлекать аудиторию." />
        {busy ? (
          <Card>
            <Thinking lines={["Ставлю цель…", "Разбиваю на фазы…", "Расписываю каждый день…", "Добавляю XP и челленджи…"]} />
          </Card>
        ) : (
          <Empty icon={<Target className="size-7" />} title="План ещё не создан" text="Я составлю пошаговый план под твою нишу, цель и свободное время." action={<Button onClick={() => makePlan()}>Создать план на 30 дней</Button>} />
        )}
      </div>
    );
  }

  const all = plan.days.flatMap((d) => d.tasks);
  const doneCount = all.filter((t) => t.done).length;
  const day = plan.days[sel];
  const dayDone = day?.tasks.filter((t) => t.done).length ?? 0;

  return (
    <div>
      <SectionHeader
        icon={<Target className="size-7 text-lime" />}
        title="План роста"
        subtitle={plan.title}
        action={
          <Button variant="soft" onClick={() => confirm("Создать новый план? Прогресс текущего будет сброшен.") && makePlan()} loading={busy} icon={<RefreshCw className="size-4" />}>
            Новый план
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={plan.source === "ai" ? "lime" : "default"}>{plan.source === "ai" ? "AI-план" : "Шаблон"}</Chip>
          </div>
          <p className="text-sm leading-relaxed text-white/75">{plan.strategy}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {plan.phases.map((ph, i) => {
              const [a] = ph.days.split(/[–-]/).map((x) => Number(x.trim()));
              const active = todayIdx + 1 >= (a || 0);
              return (
                <div key={i} className={cn("rounded-2xl border p-3", active ? "border-pink/30 bg-pink/5" : "border-white/8")}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Дни {ph.days}</div>
                  <div className="mt-1 font-semibold">{ph.name}</div>
                  <div className="mt-1 text-xs text-white/55">{ph.goal}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="flex flex-col justify-center">
          <div className="text-xs uppercase tracking-widest text-white/40">Прогресс плана</div>
          <div className="mt-2 font-display text-4xl font-bold">{Math.round((doneCount / Math.max(all.length, 1)) * 100)}%</div>
          <div className="mt-1 text-sm text-white/50">
            {doneCount} из {all.length} задач · день {todayIdx + 1}
          </div>
          <Progress value={(doneCount / Math.max(all.length, 1)) * 100} className="mt-4 h-2.5" />
        </Card>
      </div>

      <div ref={stripRef} className="mb-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {plan.days.map((d, i) => {
          const n = d.tasks.filter((t) => t.done).length;
          const full = n === d.tasks.length && d.tasks.length > 0;
          return (
            <button
              key={d.day}
              onClick={() => setSel(i)}
              className={cn(
                "relative flex w-14 shrink-0 flex-col items-center rounded-2xl py-2.5 transition",
                sel === i ? "bg-white text-black" : full ? "bg-cyan/15 text-cyan" : i === todayIdx ? "bg-pink/15 text-white ring-1 ring-pink/50" : "bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              <span className="text-[10px] font-semibold uppercase opacity-60">день</span>
              <span className="font-display text-lg font-bold">{d.day}</span>
              <span className="mt-1 flex gap-0.5">
                {d.tasks.map((t) => (
                  <span key={t.id} className={cn("size-1 rounded-full", t.done ? (sel === i ? "bg-black" : "bg-cyan") : sel === i ? "bg-black/25" : "bg-white/25")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {day && (
        <Card key={day.day}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-xl font-bold">
                День {day.day} {sel === todayIdx && <span className="text-gradient">· сегодня</span>}
              </div>
              <div className="text-sm text-white/50">{day.theme}</div>
            </div>
            <Chip tone={dayDone === day.tasks.length ? "cyan" : "default"}>
              {dayDone}/{day.tasks.length} выполнено
            </Chip>
          </div>
          <div className="space-y-2.5">
            {day.tasks.map((t, i) => {
              const K = KIND[t.kind] ?? KIND.film;
              return (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => toggle(day.day, t.id)}
                  className={cn("flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition", t.done ? "border-cyan/30 bg-cyan/5" : "border-white/8 bg-white/[0.02] hover:border-white/20")}
                >
                  <motion.div animate={t.done ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                    {t.done ? <CheckCircle2 className="size-6 text-cyan" /> : <Circle className="size-6 text-white/25" />}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-semibold", t.done && "text-white/50 line-through")}>{t.title}</span>
                      <span className={cn("flex items-center gap-1 text-xs", K.cls)}>
                        <K.icon className="size-3.5" /> {K.label}
                      </span>
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-white/60">{t.detail}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-lime/10 px-2 py-1 text-xs font-bold text-lime">+{t.xp} XP</span>
                </motion.button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
