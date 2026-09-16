import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, Target } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { buildRoadmap } from "@/lib/roadmap";

export default function Roadmap() {
  const profile = useAppStore((s) => s.profile);
  const completedTasks = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const prevPercent = useRef(0);

  const phases = useMemo(() => (profile ? buildRoadmap(profile) : []), [profile]);
  const allTasks = phases.flatMap((p) => p.tasks);
  const doneCount = allTasks.filter((t) => completedTasks.includes(t.id)).length;
  const percent = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;

  useEffect(() => {
    if (percent === 100 && prevPercent.current !== 100 && allTasks.length > 0) {
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#FE2C55", "#25F4EE", "#7c3aed"],
      });
    }
    prevPercent.current = percent;
  }, [percent, allTasks.length]);

  if (!profile) return null;

  return (
    <div>
      <PageHeader
        eyebrow="90 дней до популярности"
        title="Твой план к успеху"
        subtitle="Пошаговый roadmap, персонализированный под твои слабые места. Отмечай выполненное — так план остаётся честным отражением прогресса"
      />

      <Card className="mb-8" delay={0}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-cyan-glow" />
            <span className="text-sm font-semibold">Общий прогресс</span>
          </div>
          <span className="text-sm font-bold tabular-nums">
            {doneCount}/{allTasks.length} · {percent}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-tiktok-gradient"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </Card>

      <div className="space-y-6">
        {phases.map((phase, pi) => {
          const phaseDone = phase.tasks.filter((t) => completedTasks.includes(t.id)).length;
          const phasePercent = Math.round((phaseDone / phase.tasks.length) * 100);
          return (
            <Card key={phase.id} delay={pi * 0.08}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="text-xs font-semibold text-cyan-glow uppercase tracking-wide mb-1">
                    {phase.period}
                  </p>
                  <h3 className="font-bold text-lg">{phase.title}</h3>
                  <p className="text-sm text-ink-secondary mt-0.5">{phase.goal}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold tabular-nums">{phasePercent}%</span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {phase.tasks.map((task) => {
                  const done = completedTasks.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl transition-colors ${
                        done ? "bg-good/10" : "hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`shrink-0 mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          done ? "bg-good border-good" : "border-white/20"
                        }`}
                      >
                        {done && <Check size={13} className="text-black" />}
                      </span>
                      <span className={`text-sm ${done ? "text-ink-muted line-through" : "text-ink-primary"}`}>
                        {task.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
