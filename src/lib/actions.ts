"use client";
// Общие действия (AI-запросы) с глобальным статусом загрузки,
// чтобы при переключении вкладок запросы не дублировались и не терялись.
import { useCallback, useSyncExternalStore } from "react";
import { callAI } from "./api";
import { useStore } from "./store";
import type { AIAnalysis, GrowthPlan, ProductionPlan, TrendsResponse, VideoIdea } from "./types";
import { toast } from "@/components/toast";

type Job = "analysis" | "trends" | "ideas" | "script" | "plan";

const busy = new Set<string>();
const subs = new Set<() => void>();
let snapshot = "";
const emit = () => {
  snapshot = [...busy].sort().join("|");
  subs.forEach((s) => s());
};
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

export function useBusy(job: Job | string) {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => "");
  return snap.split("|").includes(job);
}

async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (busy.has(key)) return;
  busy.add(key);
  emit();
  try {
    return await fn();
  } catch (e) {
    toast((e as Error).message, "warn");
  } finally {
    busy.delete(key);
    emit();
  }
}

export function useActions() {
  const { state, update } = useStore();
  const { settings, account } = state;

  const note = (mode: string, warning?: string) => {
    if (warning) toast(warning, "warn");
  };

  const runAnalysis = useCallback(
    () =>
      run("analysis", async () => {
        if (!settings || !account) return;
        const r = await callAI<AIAnalysis>("analyze", { settings, account });
        note(r.mode, r.warning);
        update(() => ({ analysis: r.data }));
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, account, update],
  );

  const fetchTrends = useCallback(
    (focus?: string) =>
      run("trends", async () => {
        if (!settings) return;
        const r = await callAI<TrendsResponse>("trends", { settings, account, focus });
        note(r.mode, r.warning);
        update(() => ({ trends: r.data }));
        toast(r.data.live ? `Свежие тренды из интернета: ${r.data.trends.length} 🔥` : r.data.origin === "ai" ? `Тренды под твою нишу готовы: ${r.data.trends.length} 🔥` : "Загружены проверенные форматы", r.data.origin === "local" ? "info" : "ok");
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, account, update],
  );

  const genIdeas = useCallback(
    (opts: { focus?: string; count?: number } = {}) =>
      run("ideas", async () => {
        if (!settings) return;
        const exclude = state.ideas.map((i) => i.title);
        const r = await callAI<VideoIdea[]>("ideas", { settings, account, trends: state.trends?.trends ?? [], focus: opts.focus, count: opts.count ?? 8, exclude });
        note(r.mode, r.warning);
        update((s) => ({ ideas: [...r.data, ...s.ideas.filter((i) => i.saved)] }));
        toast(`Готово: ${r.data.length} идей для следующих видео 💡`);
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, account, state.trends, state.ideas, update],
  );

  const makeScript = useCallback(
    (idea: VideoIdea) =>
      run(`script:${idea.id}`, async () => {
        if (!settings) return;
        const r = await callAI<ProductionPlan>("script", { settings, account, idea });
        note(r.mode, r.warning);
        update((s) => ({ scripts: { ...s.scripts, [idea.id]: { idea, plan: r.data, createdAt: Date.now() } }, activeScriptId: idea.id }));
        toast("Сценарий готов — открываю Студию 🎬");
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, account, update],
  );

  const makePlan = useCallback(
    () =>
      run("plan", async () => {
        if (!settings) return;
        const r = await callAI<GrowthPlan>("plan", { settings, account });
        note(r.mode, r.warning);
        update(() => ({ plan: r.data }));
        toast("План на 30 дней готов 🎯");
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, account, update],
  );

  return { runAnalysis, fetchTrends, genIdeas, makeScript, makePlan };
}

/** Индекс текущего дня плана (0..29). */
export function planDayIndex(plan: GrowthPlan) {
  const d = Math.floor((Date.now() - plan.createdAt) / 86400000);
  return Math.max(0, Math.min(plan.days.length - 1, d));
}

/** Отметка задачи плана: XP, серия дней и конфетти при закрытии дня. */
export function useToggleTask() {
  const { state, update, addXp } = useStore();
  return useCallback(
    (day: number, taskId: string) => {
      const plan = state.plan;
      if (!plan) return;
      const d = plan.days.find((x) => x.day === day);
      const t = d?.tasks.find((x) => x.id === taskId);
      if (!d || !t) return;
      const done = !t.done;
      const days = plan.days.map((x) => (x.day === day ? { ...x, tasks: x.tasks.map((y) => (y.id === taskId ? { ...y, done } : y)) } : x));
      update(() => ({ plan: { ...plan, days } }));
      addXp(done ? t.xp : -t.xp);
      if (done) {
        const dayDone = days.find((x) => x.day === day)!.tasks.every((y) => y.done);
        if (dayDone) {
          import("@/components/ui").then((m) => m.fireConfetti());
          toast(`День ${day} закрыт! +${t.xp} XP 🎉`);
        } else {
          toast(`+${t.xp} XP`);
        }
      }
    },
    [state.plan, update, addXp],
  );
}
