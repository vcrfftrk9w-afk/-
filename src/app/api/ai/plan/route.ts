import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localGrowthPlan } from "@/lib/offline";
import { PLAN_SHAPE, planPrompt } from "@/lib/prompts";
import { normalizePlan, type RawPlan } from "@/lib/plan";
import type { GrowthPlan } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { settings, account, report } = await readBody<BaseBody>(req);
  return aiOrLocal<GrowthPlan>(
    async () => {
      const { data } = await askJSON<RawPlan>({ prompt: planPrompt(creatorBrief(settings, account, report)), shape: PLAN_SHAPE, effort: "medium", maxTokens: 48000 });
      return normalizePlan(data);
    },
    () => localGrowthPlan(settings, report),
  );
}
