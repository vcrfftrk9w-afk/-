import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, rid, type BaseBody } from "@/lib/server/route-utils";
import { localIdeas } from "@/lib/offline";
import { IDEAS_SHAPE, ideasPrompt } from "@/lib/prompts";
import type { Trend, VideoIdea } from "@/lib/types";

export const maxDuration = 300;

interface Body extends BaseBody {
  trends?: Trend[];
  focus?: string;
  exclude?: string[];
  count?: number;
}

export async function POST(req: Request) {
  const { settings, account, report, trends = [], focus, exclude = [], count = 8 } = await readBody<Body>(req);
  const n = Math.min(Math.max(count, 3), 12);
  return aiOrLocal<VideoIdea[]>(
    async () => {
      const { data } = await askJSON<{ ideas: Omit<VideoIdea, "id">[] }>({ prompt: ideasPrompt({ n, focus, exclude, trends, brief: creatorBrief(settings, account, report) }), shape: IDEAS_SHAPE, effort: "medium" });
      return (data.ideas ?? []).map((i) => ({ ...i, id: rid() })).sort((a, b) => b.viralPotential - a.viralPotential);
    },
    () => localIdeas(settings, report, trends, n),
  );
}
