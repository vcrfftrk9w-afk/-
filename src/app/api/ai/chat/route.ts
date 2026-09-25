import type Anthropic from "@anthropic-ai/sdk";
import { aiEnabled, BASE_SYSTEM, streamChat } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { readBody, type BaseBody } from "@/lib/server/route-utils";
import { localCoachReply } from "@/lib/offline";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 300;

interface Body extends BaseBody {
  messages: ChatMessage[];
}

export async function POST(req: Request) {
  const { settings, account, report, messages } = await readBody<Body>(req);
  const history = (messages ?? []).filter((m) => m.content.trim()).slice(-20);
  const last = history[history.length - 1]?.content ?? "";

  const headers = { "Content-Type": "text/plain; charset=utf-8", "X-Mode": aiEnabled() ? "ai" : "local" };
  if (!aiEnabled()) {
    return new Response(localCoachReply(last, settings, report), { headers });
  }

  const system = `${BASE_SYSTEM}

Ты — личный AI-коуч автора в приложении ViralPilot. Отвечай в Markdown: коротко, структурно, с конкретикой (готовые хуки, тексты, тайминги, цифры). Если автор просит идею — давай готовый сценарий. Задавай уточняющий вопрос только если без него ответ будет бесполезен.

ДАННЫЕ АВТОРА:
${creatorBrief(settings, account, report)}`;

  const msgs: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  // API требует, чтобы диалог начинался с user
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return new Response(streamChat({ system, messages: msgs }), { headers });
}
