import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localProductionPlan } from "@/lib/offline";
import type { ProductionPlan, VideoIdea } from "@/lib/types";

export const maxDuration = 300;

const SHAPE = `{
  "title": string,
  "hookVariants": string[],      // 3 варианта хука для A/B теста
  "scenes": [{ "t": string, "shot": string, "action": string, "onScreenText": string, "voiceover": string }], // посекундная раскадровка, t вида "0–2с"
  "shotList": string[],          // список кадров для съёмки (в каком порядке снимать)
  "equipment": string[],
  "lighting": string,
  "editing": string[],           // пошаговый монтаж (CapCut/встроенный редактор): переходы, тайминги, эффекты, субтитры
  "sound": string,
  "caption": string,             // готовая подпись с ключевыми словами
  "hashtags": string[],          // 3–5
  "cta": string,
  "postingTime": string,
  "pinnedComment": string,
  "checklist": string[],         // чек-лист перед публикацией
  "mistakesToAvoid": string[]
}`;

interface Body extends BaseBody {
  idea: VideoIdea;
}

export async function POST(req: Request) {
  const { settings, account, report, idea } = await readBody<Body>(req);
  if (!idea) return Response.json({ error: "Нет идеи" }, { status: 400 });
  return aiOrLocal<ProductionPlan>(
    async () => {
      const { data } = await askJSON<Omit<ProductionPlan, "source">>({
        prompt: `Сделай ПОЛНУЮ продакшн-инструкцию для ролика — так, чтобы автор мог взять телефон и снять его с первого раза.
Посекундная раскадровка, что говорить, какой текст на экране, ракурсы, свет, как смонтировать, какую подпись и хэштеги поставить, когда выложить.
Учитывай ресурсы автора (лицо в кадре, опыт, оборудование — считай, что есть только смартфон).

ИДЕЯ:
Название: ${idea.title}
Хук: ${idea.hook}
Концепт: ${idea.concept}
Формат: ${idea.format}${idea.trendRef ? `\nТренд: ${idea.trendRef}` : ""}${idea.sound ? `\nЗвук: ${idea.sound}` : ""}
Длительность: ~${idea.durationSec} сек

Об авторе:
${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        effort: "medium",
      });
      return { ...data, source: "ai" as const };
    },
    () => localProductionPlan(idea, settings, report),
  );
}
