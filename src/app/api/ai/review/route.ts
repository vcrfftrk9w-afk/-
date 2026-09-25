import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localReview } from "@/lib/offline";
import { REVIEW_SHAPE, reviewPrompt, videoReviewPrompt, type ReviewResult } from "@/lib/prompts";

export const maxDuration = 300;

interface Body extends BaseBody {
  description: string;
  meta?: { title?: string; author?: string };
  stats?: { views?: number; likes?: number; comments?: number; shares?: number; duration?: number };
  frames?: { t: number; dataUrl: string }[];
  duration?: number;
}

export async function POST(req: Request) {
  const { settings, account, report, description, meta, stats, frames, duration } = await readBody<Body>(req);
  return aiOrLocal<ReviewResult>(
    async () => {
      if (frames?.length) {
        const { data } = await askJSON<ReviewResult>({
          prompt: videoReviewPrompt({ frameTimes: frames.map((f) => f.t), duration: duration ?? 0, description, stats, brief: creatorBrief(settings, account, report) }),
          shape: REVIEW_SHAPE,
          images: frames.map((f) => f.dataUrl),
          effort: "medium",
        });
        return data;
      }
      const { data } = await askJSON<ReviewResult>({ prompt: reviewPrompt({ description, metaTitle: meta?.title, stats, brief: creatorBrief(settings, account, report) }), shape: REVIEW_SHAPE, effort: "medium" });
      return data;
    },
    () => localReview(`${meta?.title ?? ""} ${description}`.trim(), settings.niche, stats),
  );
}
