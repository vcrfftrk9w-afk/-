import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localAnalysis } from "@/lib/offline";
import type { AIAnalysis } from "@/lib/types";

export const maxDuration = 300;

const SHAPE = `{
  "summary": string,            // 2–3 предложения: где автор сейчас
  "diagnosis": string,          // главная причина, почему рост медленнее, чем мог бы (с опорой на цифры)
  "strengths": string[],        // 3–4 пункта
  "weaknesses": string[],       // 3–4 пункта
  "priorities": [{ "title": string, "why": string, "how": string, "impact": "high"|"medium"|"low" }], // 4–6 шагов, самые важные первыми, "how" — конкретные действия
  "contentPillars": [{ "name": string, "description": string, "share": number }], // 3–4 рубрики, share в % (сумма 100)
  "profileFixes": [{ "field": string, "current": string, "suggestion": string }],  // имя, био, аватар, закрепы, плейлисты
  "hookAdvice": string[],       // 5 готовых хуков под этого автора
  "predictedFollowers30d": number // реалистичный прогноз подписчиков через 30 дней при выполнении плана
}`;

export async function POST(req: Request) {
  const { settings, account, report } = await readBody(req);
  if (!account || !report) return Response.json({ error: "Нет данных аккаунта" }, { status: 400 });
  return aiOrLocal<AIAnalysis>(
    async () => {
      const { data } = await askJSON<Omit<AIAnalysis, "source">>({
        prompt: `Проведи глубокий аудит TikTok-аккаунта и дай стратегию максимально быстрого роста.
Найди закономерности: какие темы/длины/хэштеги/время дают просмотры, а какие проваливаются. Сравни лучшие и худшие ролики.

${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        effort: "medium",
      });
      return { ...data, source: "ai" as const };
    },
    () => localAnalysis(account, settings, report),
  );
}
