import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localTool } from "@/lib/offline";

export const maxDuration = 120;

const TASKS: Record<string, string> = {
  hooks: "Напиши 10 мощных хуков (текст для первых 1–2 секунд ролика) на тему. Разные формулы: шок, ошибка, секрет, POV, отсчёт, спор, история.",
  captions: "Напиши 6 подписей к ролику на тему: с ключевыми словами для поиска, эмоцией и вопросом/призывом к комментарию. Каждая — с 3–5 хэштегами в конце.",
  hashtags: "Подбери 4 набора хэштегов (по 4–6 в каждом) по формуле: 1 широкий + 2 нишевых + 1–2 узких под тему. Каждый набор — одной строкой через пробел.",
  bio: "Напиши 5 вариантов био для профиля TikTok (до 80 символов): кто автор + польза + частота/призыв. С эмодзи.",
  rewrite: "Перепиши текст/сценарий так, чтобы он удерживал внимание в TikTok: сильный хук, короткие фразы, открытые петли, призыв в конце. Дай 3 варианта.",
  names: "Придумай 8 названий для рубрик/серий роликов, которые хочется смотреть сериями.",
};

interface Body extends BaseBody {
  tool: string;
  topic: string;
}

export async function POST(req: Request) {
  const { settings, account, report, tool, topic } = await readBody<Body>(req);
  const task = TASKS[tool];
  if (!task) return Response.json({ error: "Неизвестный инструмент" }, { status: 400 });
  return aiOrLocal<string[]>(
    async () => {
      const { data } = await askJSON<{ items: string[] }>({
        prompt: `${task}
ТЕМА / ТЕКСТ: ${topic || "на усмотрение, под нишу автора"}

Об авторе:
${creatorBrief(settings, account, report)}`,
        shape: `{ "items": string[] }`,
        effort: "low",
        maxTokens: 8000,
      });
      return data.items ?? [];
    },
    () => localTool(tool === "rewrite" || tool === "names" ? "hooks" : tool, topic, settings),
  );
}
