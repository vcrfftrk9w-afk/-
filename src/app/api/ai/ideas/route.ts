import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, rid, type BaseBody } from "@/lib/server/route-utils";
import { localIdeas } from "@/lib/offline";
import type { Trend, VideoIdea } from "@/lib/types";

export const maxDuration = 300;

const SHAPE = `{
  "ideas": [{
    "title": string,
    "hook": string,               // точная фраза/текст первых 1–2 секунд
    "concept": string,            // что происходит в ролике, 2–3 предложения
    "format": string,             // формат (POV, туториал, серия, переход и т.д.)
    "trendRef": string,           // название тренда, если используется, иначе ""
    "viralPotential": number,     // 0–100, честная оценка
    "effort": "low"|"medium"|"high",
    "durationSec": number,
    "whyItWillWork": string,      // почему сработает именно у этого автора (опирайся на его метрики)
    "hashtags": string[],         // 3–5
    "sound": string               // звук/музыка, иначе ""
  }]
}`;

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
      const { data } = await askJSON<{ ideas: Omit<VideoIdea, "id">[] }>({
        prompt: `Придумай ${n} идей для СЛЕДУЮЩИХ видео этого автора, которые дадут максимальный рост подписчиков.
Правила: сильный хук в первые 1–2 секунды; смесь форматов (трендовые, полезные/сохраняемые, провоцирующие комментарии, серийные); опирайся на то, что уже сработало у автора; учитывай его ресурсы (время, лицо в кадре, опыт).
${focus ? `Пожелание автора: ${focus}\n` : ""}${exclude.length ? `Не повторяй эти идеи: ${exclude.slice(0, 30).join("; ")}\n` : ""}${trends.length ? `Актуальные тренды, которые можно использовать: ${trends.slice(0, 10).map((t) => `${t.name} (${t.type}${t.sound ? `, звук: ${t.sound}` : ""})`).join("; ")}\n` : ""}
Об авторе:
${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        effort: "medium",
      });
      return (data.ideas ?? []).map((i) => ({ ...i, id: rid() })).sort((a, b) => b.viralPotential - a.viralPotential);
    },
    () => localIdeas(settings, report, trends, n),
  );
}
