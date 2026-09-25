// ─────────────────────────────────────────────────────────────────────────────
// Серверный AI-слой на Claude API.
// • Все запросы — стриминг (долгие ответы не упираются в таймауты HTTP).
// • Серверные фолбэки (fallbacks: "default"): если модель отклонит запрос,
//   API сам перезапустит его на рекомендованной резервной модели.
// • Веб-поиск (web_search) — для поиска актуальных трендов TikTok.
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";
import { BASE_SYSTEM, jsonInstruction } from "../prompts";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

let _client: Anthropic | null | undefined;
export function getClient(): Anthropic | null {
  if (_client !== undefined) return _client;
  _client = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic() : null;
  return _client;
}

export const aiEnabled = () => getClient() !== null;

export class AIRefusalError extends Error {}

export { BASE_SYSTEM };

type Effort = "low" | "medium" | "high";

export interface JSONResult<T> {
  data: T;
  sources: { title: string; url: string }[];
}

/** Запрос, который должен вернуть JSON. Если webSearch=true — модель ищет в интернете. */
export async function askJSON<T>(opts: {
  system?: string;
  prompt: string;
  shape: string; // описание формы JSON (TypeScript-подобное)
  webSearch?: boolean;
  effort?: Effort;
  maxTokens?: number;
}): Promise<JSONResult<T>> {
  const client = getClient();
  if (!client) throw new Error("AI не настроен");

  const system = `${opts.system ?? BASE_SYSTEM}

${jsonInstruction(opts.shape)}`;

  const tools: Anthropic.Beta.BetaToolUnion[] | undefined = opts.webSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }]
    : undefined;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const sources: { title: string; url: string }[] = [];
  let text = "";

  // Цикл нужен для pause_turn: серверный инструмент (поиск) может приостановить ход.
  for (let i = 0; i < 4; i++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 32000,
      betas: BETAS,
      fallbacks: "default",
      system,
      output_config: { effort: opts.effort ?? "medium" },
      ...(tools ? { tools } : {}),
      messages,
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new AIRefusalError("Модель отклонила запрос. Попробуй переформулировать.");
    }

    for (const block of msg.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result") sources.push({ title: r.title, url: r.url });
        }
      }
    }

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    break;
  }

  const data = extractJSON<T>(text);
  const unique = Array.from(new Map(sources.map((s) => [s.url, s])).values()).slice(0, 12);
  return { data, sources: unique };
}

/** Достаёт JSON из ответа, даже если модель обернула его в текст/markdown. */
export function extractJSON<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstObj = cleaned.indexOf("{");
    const firstArr = cleaned.indexOf("[");
    const start = firstArr !== -1 && (firstObj === -1 || firstArr < firstObj) ? firstArr : firstObj;
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start === -1 || end === -1) throw new Error("AI вернул ответ не в формате JSON");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

/** Стриминговый чат: возвращает ReadableStream с текстом ответа. */
export function streamChat(opts: { system: string; messages: Anthropic.Beta.BetaMessageParam[] }): ReadableStream<Uint8Array> {
  const client = getClient();
  if (!client) throw new Error("AI не настроен");
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: BETAS,
          fallbacks: "default",
          system: opts.system,
          output_config: { effort: "low" },
          messages: opts.messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n_Не могу ответить на этот запрос. Попробуй спросить иначе._"));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n⚠️ Ошибка AI: ${errorMessage(err)}`));
      } finally {
        controller.close();
      }
    },
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "неверный ANTHROPIC_API_KEY";
  if (err instanceof Anthropic.RateLimitError) return "превышен лимит запросов, попробуй через минуту";
  if (err instanceof Anthropic.APIError) return `API ${err.status ?? ""}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
