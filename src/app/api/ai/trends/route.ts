import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, rid, today, type BaseBody } from "@/lib/server/route-utils";
import { localTrends } from "@/lib/offline";
import { getNiche } from "@/lib/knowledge";
import type { Trend, TrendsResponse } from "@/lib/types";

export const maxDuration = 300;

const SHAPE = `{
  "trends": [{
    "name": string,                 // название тренда/звука/формата
    "type": "sound"|"format"|"hashtag"|"challenge"|"effect"|"meme",
    "description": string,          // что это и как выглядит
    "whyItWorks": string,           // почему алгоритм это продвигает
    "howToShoot": string[],         // 5–7 конкретных шагов, как снять ИМЕННО этому автору в его нише (ракурсы, тайминг, текст, монтаж)
    "hashtags": string[],           // 3–6
    "sound": string,                // название звука/трека, если есть, иначе ""
    "heat": number,                 // 0–100 насколько горячий сейчас
    "lifecycle": "rising"|"peak"|"fading"|"evergreen",
    "difficulty": "easy"|"medium"|"hard",
    "nicheFit": number,             // 0–100 насколько подходит нише автора
    "exampleIdea": string           // готовая идея ролика для этого автора
  }],
  "note": string                    // 1–2 предложения: общая картина трендов сейчас
}`;

interface Body extends BaseBody {
  focus?: string;
}

export async function POST(req: Request) {
  const { settings, account, report, focus } = await readBody<Body>(req);
  const niche = getNiche(settings.niche);
  return aiOrLocal<TrendsResponse>(
    async () => {
      const { data, sources } = await askJSON<{ trends: Omit<Trend, "id" | "sources">[]; note: string }>({
        prompt: `Сегодня ${today()}. С помощью веб-поиска найди АКТУАЛЬНЫЕ тренды TikTok (последние 1–3 недели), которые подходят автору в нише «${niche.label}»${settings.subNiche ? ` (${settings.subNiche})` : ""}, регион ${settings.region}.
Ищи: вирусные звуки и песни, форматы видео, челленджи, мемы, эффекты, хэштеги. Полезные источники: TikTok Creative Center (ads.tiktok.com/business/creativecenter), новостные и маркетинговые блоги о трендах TikTok, подборки «TikTok trends this week», региональные медиа.
${focus ? `Автор особенно интересуется: ${focus}.\n` : ""}Верни 8–10 трендов, самые горячие и подходящие — первыми. Для каждого дай пошаговую инструкцию, как снять его ИМЕННО этому автору.
Если тренд уже угасает — честно пометь lifecycle "fading".

Об авторе:
${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        webSearch: true,
        effort: "medium",
      });
      return {
        trends: (data.trends ?? []).map((t) => ({ ...t, id: rid(), sources })),
        fetchedAt: Date.now(),
        live: true,
        note: data.note,
      };
    },
    () => localTrends(settings),
  );
}
