import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localGrowthPlan } from "@/lib/offline";
import type { GrowthPlan, PlanDay } from "@/lib/types";

export const maxDuration = 300;

const SHAPE = `{
  "title": string,
  "strategy": string,                 // 3–5 предложений: стратегия роста
  "phases": [{ "name": string, "days": string, "goal": string }], // 3–4 фазы
  "days": [{                          // РОВНО 30 дней
    "day": number,
    "theme": string,                  // короткая тема дня
    "tasks": [{ "title": string, "detail": string, "kind": "film"|"post"|"engage"|"learn"|"optimize"|"live", "xp": number }] // 2–4 задачи, detail — конкретно что сделать (для съёмки — идея и хук), xp 10–80
  }]
}`;

export async function POST(req: Request) {
  const { settings, account, report } = await readBody<BaseBody>(req);
  return aiOrLocal<GrowthPlan>(
    async () => {
      const { data } = await askJSON<{ title: string; strategy: string; phases: GrowthPlan["phases"]; days: (Omit<PlanDay, "tasks"> & { tasks: Omit<PlanDay["tasks"][number], "id">[] })[] }>({
        prompt: `Составь персональный 30-дневный план роста TikTok-аккаунта — самый быстрый реалистичный путь к цели.
Каждый день — конкретные задачи: какое видео снять (с идеей и хуком), когда выложить, как вовлекать аудиторию, что проанализировать. Учитывай доступное время автора и частоту публикаций.

${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        effort: "medium",
        maxTokens: 48000,
      });
      return {
        title: data.title,
        strategy: data.strategy,
        phases: data.phases,
        days: (data.days ?? []).map((d) => ({ ...d, tasks: d.tasks.map((t, i) => ({ ...t, id: `d${d.day}-${i}` })) })),
        createdAt: Date.now(),
        source: "ai" as const,
      };
    },
    () => localGrowthPlan(settings, report),
  );
}
