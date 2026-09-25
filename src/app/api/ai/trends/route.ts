import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, rid, today, type BaseBody } from "@/lib/server/route-utils";
import { localTrends } from "@/lib/offline";
import { getNiche } from "@/lib/knowledge";
import { TRENDS_SHAPE, trendsPrompt } from "@/lib/prompts";
import type { Trend, TrendsResponse } from "@/lib/types";

export const maxDuration = 300;

interface Body extends BaseBody {
  focus?: string;
}

export async function POST(req: Request) {
  const { settings, account, report, focus } = await readBody<Body>(req);
  const niche = getNiche(settings.niche);
  return aiOrLocal<TrendsResponse>(
    async () => {
      const { data, sources } = await askJSON<{ trends: Omit<Trend, "id" | "sources">[]; note: string }>({
        prompt: trendsPrompt({ today: today(), nicheLabel: niche.label, subNiche: settings.subNiche, region: settings.region, focus, brief: creatorBrief(settings, account, report), web: true }),
        shape: TRENDS_SHAPE,
        webSearch: true,
        effort: "medium",
      });
      return { trends: (data.trends ?? []).map((t) => ({ ...t, id: rid(), sources })), fetchedAt: Date.now(), live: sources.length > 0, origin: sources.length ? ("web" as const) : ("ai" as const), note: data.note };
    },
    () => localTrends(settings),
  );
}
