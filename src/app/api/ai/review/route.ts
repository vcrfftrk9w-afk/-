import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { getNiche } from "@/lib/knowledge";

export const maxDuration = 300;

export interface ReviewResult {
  score: number;
  verdict: string;
  scores: { name: string; score: number; comment: string }[];
  improvements: string[];
  betterHooks: string[];
  betterCaption: string;
  hashtags: string[];
}

interface Body extends BaseBody {
  description: string;
  meta?: { title?: string; author?: string };
  stats?: { views?: number; likes?: number; comments?: number; shares?: number; duration?: number };
}

const SHAPE = `{
  "score": number,                // 0–100 общий потенциал
  "verdict": string,              // 2–3 предложения
  "scores": [{ "name": string, "score": number, "comment": string }], // Хук, Удержание, Ценность, Вовлечение, SEO, Трендовость
  "improvements": string[],       // 5–7 конкретных правок
  "betterHooks": string[],        // 3 варианта
  "betterCaption": string,
  "hashtags": string[]
}`;

function localReview(desc: string, nicheId: string, stats?: Body["stats"]): ReviewResult {
  const niche = getNiche(nicheId);
  const hasHook = /\?|!|pov|как|почему|секрет|ошибк|никогда|часть/i.test(desc.slice(0, 80));
  const tags = (desc.match(/#\S+/g) ?? []).length;
  const er = stats?.views ? (((stats.likes ?? 0) + (stats.comments ?? 0) + (stats.shares ?? 0)) / stats.views) * 100 : null;
  const hookS = hasHook ? 70 : 40;
  const seoS = tags >= 3 && tags <= 6 ? 75 : tags ? 50 : 25;
  const engS = er === null ? 55 : Math.min(95, Math.round(er * 9));
  const lenS = stats?.duration ? (stats.duration <= 35 ? 75 : stats.duration <= 90 ? 62 : 50) : 60;
  const score = Math.round(hookS * 0.35 + engS * 0.3 + seoS * 0.15 + lenS * 0.2);
  return {
    score,
    verdict: `Потенциал ${score}/100. ${hasHook ? "Есть зацепка в начале" : "Нет явного хука в начале"}, ${tags ? `${tags} хэштегов` : "хэштегов нет"}${er !== null ? `, ER ${er.toFixed(1)}%` : ""}.`,
    scores: [
      { name: "Хук", score: hookS, comment: hasHook ? "Начало цепляет вопросом/обещанием" : "Начни с результата, конфликта или вопроса" },
      { name: "Удержание", score: lenS, comment: "Короче = выше досматриваемость. Смена кадра каждые 2–3 сек" },
      { name: "Вовлечение", score: engS, comment: er === null ? "Добавь статистику для точной оценки" : `ER ${er.toFixed(1)}% (норма ниши ≈${niche.benchmarkER}%)` },
      { name: "SEO", score: seoS, comment: "3–5 точных хэштегов + ключевые слова в подписи" },
    ],
    improvements: [
      "Первый кадр — самый интересный момент ролика + крупный текст-хук",
      "Убери приветствие и любые паузы в начале",
      "Добавь вопрос в конце и закрепи свой комментарий",
      "Субтитры в безопасной зоне экрана",
      "Закольцуй концовку с началом для пересмотров",
    ],
    betterHooks: [`Никто не говорит об этом: ${desc.slice(0, 40)}…`, "Смотри до конца — такого ты не ожидал(а)", "3 секунды, которые изменят твой взгляд на это"],
    betterCaption: `${desc.replace(/#\S+/g, "").trim().slice(0, 100)} — а ты что думаешь? 👇`,
    hashtags: niche.hashtags.slice(0, 5),
  };
}

export async function POST(req: Request) {
  const { settings, account, report, description, meta, stats } = await readBody<Body>(req);
  return aiOrLocal<ReviewResult>(
    async () => {
      const { data } = await askJSON<ReviewResult>({
        prompt: `Разбери ролик TikTok как топ-продюсер: оцени потенциал и скажи, что конкретно изменить, чтобы он залетел в рекомендации.
Описание/сценарий ролика от автора: ${description || "—"}
${meta?.title ? `Подпись опубликованного ролика: ${meta.title}\n` : ""}${stats ? `Статистика: ${JSON.stringify(stats)}\n` : ""}
Об авторе:
${creatorBrief(settings, account, report)}`,
        shape: SHAPE,
        effort: "medium",
      });
      return data;
    },
    () => localReview(`${meta?.title ?? ""} ${description}`.trim(), settings.niche, stats),
  );
}
