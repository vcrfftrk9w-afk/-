import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody } from "@/lib/server/route-utils";
import { localAnalysis } from "@/lib/offline";
import { ANALYZE_SHAPE, analyzePrompt } from "@/lib/prompts";
import type { AIAnalysis } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { settings, account, report } = await readBody(req);
  if (!account || !report) return Response.json({ error: "Нет данных аккаунта" }, { status: 400 });
  return aiOrLocal<AIAnalysis>(
    async () => {
      const { data } = await askJSON<Omit<AIAnalysis, "source">>({ prompt: analyzePrompt(creatorBrief(settings, account, report)), shape: ANALYZE_SHAPE, effort: "medium" });
      return { ...data, source: "ai" as const };
    },
    () => localAnalysis(account, settings, report),
  );
}
