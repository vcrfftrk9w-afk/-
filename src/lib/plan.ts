import type { GrowthPlan, PlanDay } from "./types";

export type RawPlan = {
  title: string;
  strategy: string;
  phases: GrowthPlan["phases"];
  days: (Omit<PlanDay, "tasks"> & { tasks: Omit<PlanDay["tasks"][number], "id">[] })[];
};

/** Приводит ответ ИИ к GrowthPlan: id задач, дата старта. */
export function normalizePlan(data: RawPlan): GrowthPlan {
  return {
    title: data.title,
    strategy: data.strategy,
    phases: data.phases ?? [],
    days: (data.days ?? []).map((d, di) => ({
      day: Number(d.day) || di + 1,
      theme: d.theme,
      tasks: (d.tasks ?? []).map((t, i) => ({ ...t, xp: Number(t.xp) || 20, id: `d${Number(d.day) || di + 1}-${i}` })),
    })),
    createdAt: Date.now(),
    source: "ai",
  };
}
