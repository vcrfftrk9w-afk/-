import { askJSON } from "@/lib/server/ai";
import { creatorBrief } from "@/lib/server/context";
import { aiOrLocal, readBody, type BaseBody } from "@/lib/server/route-utils";
import { localTool } from "@/lib/offline";
import { TOOL_SHAPE, TOOL_TASKS, toolPrompt } from "@/lib/prompts";

export const maxDuration = 120;

interface Body extends BaseBody {
  tool: string;
  topic: string;
}

export async function POST(req: Request) {
  const { settings, account, report, tool, topic } = await readBody<Body>(req);
  const task = TOOL_TASKS[tool];
  if (!task) return Response.json({ error: "Неизвестный инструмент" }, { status: 400 });
  return aiOrLocal<string[]>(
    async () => {
      const { data } = await askJSON<{ items: string[] }>({ prompt: toolPrompt(task, topic, creatorBrief(settings, account, report)), shape: TOOL_SHAPE, effort: "low", maxTokens: 8000 });
      return data.items ?? [];
    },
    () => localTool(tool === "rewrite" || tool === "names" ? "hooks" : tool, topic, settings),
  );
}
