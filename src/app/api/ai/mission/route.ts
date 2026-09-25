import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, rid, type BaseBody } from "@/lib/server/route-utils";
import { buildContentDNA } from "@/lib/content";
import { localMission, nextPostTime } from "@/lib/mission";
import { MISSION_SHAPE, missionPrompt } from "@/lib/prompts";
import type { DeepAnalysis, Mission, Trend } from "@/lib/types";

export const maxDuration = 300;

interface Body extends BaseBody {
  trends?: Trend[];
  deep?: DeepAnalysis | null;
  number?: number;
  shift?: number;
}

const KIND_HINT: Record<Mission["kind"], string> = {
  starter: "ролик-знакомство (визитка аккаунта)",
  "repeat-best": "повтор формулы самого удачного ролика автора с новым поворотом",
  trend: "актуальный тренд, адаптированный под тему автора",
  series: "первая часть серии с продолжением",
  reply: "ответ видео на комментарий зрителя",
  seed: "проверенный формат ниши, продолжающий то, что автор уже снимает",
};

export async function POST(req: Request) {
  const { settings, account, report, trends = [], deep = null, number = 1, shift = 0 } = await readBody<Body>(req);
  if (!account) return Response.json({ error: "Нет данных аккаунта" }, { status: 400 });
  const dna = buildContentDNA(account, settings, report);
  const local = localMission({ account, settings, report, dna, trends, deep, number, shift });
  return aiOrLocal<Mission>(
    async () => {
      const { data } = await askJSON<Omit<Mission, "id" | "number" | "createdAt" | "kind" | "source">>({
        prompt: missionPrompt({
          brief: creatorBrief(settings, account, report),
          number: number,
          kindHint: KIND_HINT[local.kind],
          postAt: nextPostTime(report),
          trends: trends
            .slice(0, 8)
            .map((t) => `${t.name} (${t.type}${t.sound ? `, звук «${t.sound}»` : ""})`)
            .join("; "),
          deep: deep && deep.source === "ai" ? `${deep.whatYouFilm} Формула: ${deep.formula}` : undefined,
          avoid: shift ? "Автор попросил другую идею — предложи что-то заметно отличающееся от очевидного варианта." : undefined,
        }),
        shape: MISSION_SHAPE,
        effort: "medium",
      });
      return {
        ...local,
        ...data,
        id: rid(),
        number,
        createdAt: Date.now(),
        kind: local.kind,
        prep: data.prep?.length ? data.prep : local.prep,
        shots: data.shots?.length ? data.shots : local.shots,
        edit: data.edit?.length ? data.edit : local.edit,
        afterPost: data.afterPost?.length ? data.afterPost : local.afterPost,
        hashtags: data.hashtags?.length ? data.hashtags : local.hashtags,
        bonus: data.bonus?.length ? data.bonus : local.bonus,
        source: "ai" as const,
      };
    },
    () => local,
  );
}
