import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localProductionPlan } from "@/lib/offline";
import { SCRIPT_SHAPE, scriptPrompt } from "@/lib/prompts";
import type { ProductionPlan, VideoIdea } from "@/lib/types";

export const maxDuration = 300;

interface Body extends BaseBody {
  idea: VideoIdea;
}

export async function POST(req: Request) {
  const { settings, account, report, idea } = await readBody<Body>(req);
  if (!idea) return Response.json({ error: "Нет идеи" }, { status: 400 });
  return aiOrLocal<ProductionPlan>(
    async () => {
      const { data } = await askJSON<Omit<ProductionPlan, "source">>({ prompt: scriptPrompt(idea, creatorBrief(settings, account, report)), shape: SCRIPT_SHAPE, effort: "medium" });
      return { ...data, source: "ai" as const };
    },
    () => localProductionPlan(idea, settings, report),
  );
}
