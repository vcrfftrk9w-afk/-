import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody } from "@/lib/server/route-utils";
import { buildContentDNA } from "@/lib/content";
import { localDeep } from "@/lib/mission";
import { DEEP_SHAPE, deepPrompt } from "@/lib/prompts";
import type { DeepAnalysis, TikTokVideo } from "@/lib/types";

export const maxDuration = 300;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Скачивает обложку ролика и отдаёт data URL (или null, если формат не подходит). */
async function coverDataUrl(v: TikTokVideo): Promise<string | null> {
  if (!v.coverUrl) return null;
  try {
    const res = await fetch(v.coverUrl, { cache: "no-store", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!IMAGE_TYPES.includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { settings, account, report } = await readBody(req);
  if (!account) return Response.json({ error: "Нет данных аккаунта" }, { status: 400 });
  const dna = buildContentDNA(account, settings, report);
  return aiOrLocal<DeepAnalysis>(
    async () => {
      const vids = [...account.videos].sort((a, b) => b.createTime - a.createTime).slice(0, 12);
      const imgs = await Promise.all(vids.map(coverDataUrl));
      const covers: { n: number; id: string }[] = [];
      const images: string[] = [];
      imgs.forEach((img, i) => {
        if (!img) return;
        images.push(img);
        covers.push({ n: images.length, id: vids[i].id });
      });
      const { data } = await askJSON<Omit<DeepAnalysis, "createdAt" | "source">>({
        prompt: deepPrompt({ brief: creatorBrief(settings, account, report), covers }),
        shape: DEEP_SHAPE,
        images,
        effort: "medium",
      });
      const known = new Set(account.videos.map((v) => v.id));
      return {
        ...data,
        videos: (data.videos ?? []).filter((v) => known.has(String(v.id))).map((v) => ({ ...v, id: String(v.id) })),
        more: data.more ?? [],
        stop: data.stop ?? [],
        nextVideos: data.nextVideos ?? [],
        createdAt: Date.now(),
        source: "ai" as const,
      };
    },
    () => localDeep(dna, account, settings),
  );
}
