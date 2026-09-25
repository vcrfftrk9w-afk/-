import { aiEnabled, askJSON, errorMessage } from "@/lib/server/ai";
import { SCREENS_SHAPE, screensPrompt, type ScreensImport } from "@/lib/prompts";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { images } = (await req.json()) as { images?: string[] };
  if (!images?.length) return Response.json({ error: "Загрузи хотя бы один скриншот" }, { status: 400 });
  if (!aiEnabled()) return Response.json({ error: "Распознавание скриншотов работает с подключённым ИИ (ANTHROPIC_API_KEY)" }, { status: 400 });
  try {
    const { data } = await askJSON<ScreensImport>({
      system: "Ты точно извлекаешь данные со скриншотов TikTok. Никогда не выдумываешь значения.",
      prompt: screensPrompt(images.length),
      shape: SCREENS_SHAPE,
      images: images.slice(0, 10),
      effort: "medium",
    });
    return Response.json({ data, mode: "ai" });
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 502 });
  }
}
