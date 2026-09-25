import type Anthropic from "@anthropic-ai/sdk";
import { aiReady, streamChat } from "@/lib/server/ai";
import { coachSystem } from "@/lib/prompts";
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

  const ready = (await aiReady()).ok;
  const headers = { "Content-Type": "text/plain; charset=utf-8", "X-Mode": ready ? "ai" : "local" };
  if (!ready) {
    return new Response(localCoachReply(last, settings, report), { headers });
  }

  const system = coachSystem(creatorBrief(settings, account, report));

  const msgs: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  // API требует, чтобы диалог начинался с user
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return new Response(streamChat({ system, messages: msgs }), { headers });
}
