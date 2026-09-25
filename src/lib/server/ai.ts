// ─────────────────────────────────────────────────────────────────────────────
// Серверный AI-слой на Claude API.
// • Все запросы — стриминг (долгие ответы не упираются в таймауты HTTP).
// • Серверные фолбэки (fallbacks: "default"): если модель отклонит запрос,
//   API сам перезапустит его на рекомендованной резервной модели.
// • Веб-поиск (web_search) — для поиска актуальных трендов TikTok.
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { BASE_SYSTEM, jsonInstruction } from "../prompts";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];
const GATEWAY_URL = "https://ai-gateway.vercel.sh";

/**
 * Откуда берём доступ к Claude:
 *  • ANTHROPIC_API_KEY — напрямую в Claude API (все возможности: фолбэки, effort, веб-поиск);
 *  • AI_GATEWAY_API_KEY — через Vercel AI Gateway;
 *  • на Vercel без ключей — OIDC-токен проекта через Vercel AI Gateway.
 */
type Access = { mode: "direct"; client: Anthropic } | { mode: "gateway"; client: Anthropic };

let _direct: Anthropic | undefined;
function oidcToken(): string | null {
  try {
    return getVercelOidcTokenSync() || null;
  } catch {
    return process.env.VERCEL_OIDC_TOKEN || null;
  }
}

function access(): Access | null {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    _direct ??= new Anthropic();
    return { mode: "direct", client: _direct };
  }
  // Токен OIDC живёт недолго — клиент создаём на каждый запрос.
  const key = process.env.AI_GATEWAY_API_KEY || oidcToken();
  if (key) return { mode: "gateway", client: new Anthropic({ apiKey: key, baseURL: GATEWAY_URL }) };
  return null;
}

export function getClient(): Anthropic | null {
  return access()?.client ?? null;
}

export const aiEnabled = () => access() !== null;
export const aiMode = () => access()?.mode ?? null;

export class AIRefusalError extends Error {}

export { BASE_SYSTEM };

type Effort = "low" | "medium" | "high";

export interface JSONResult<T> {
  data: T;
  sources: { title: string; url: string }[];
}


type StreamParams = {
  max_tokens: number;
  system: string;
  effort: Effort;
  tools?: Anthropic.Beta.BetaToolUnion[];
  messages: Anthropic.Beta.BetaMessageParam[];
};

/**
 * Открывает стрим в Claude. Напрямую — с серверными фолбэками и effort;
 * через AI Gateway — обычный Messages API (модель с префиксом anthropic/).
 */
function openStream(acc: Access, p: StreamParams, plain = false) {
  if (acc.mode === "direct") {
    return acc.client.beta.messages.stream({
      model: MODEL,
      max_tokens: p.max_tokens,
      betas: BETAS,
      fallbacks: "default",
      system: p.system,
      output_config: { effort: p.effort },
      ...(p.tools ? { tools: p.tools } : {}),
      messages: p.messages,
    });
  }
  const params = {
    model: `anthropic/${MODEL}`,
    max_tokens: p.max_tokens,
    system: p.system,
    ...(plain ? {} : { output_config: { effort: p.effort } }),
    ...(p.tools && !plain ? { tools: p.tools } : {}),
    messages: p.messages,
  } as unknown as Anthropic.MessageStreamParams;
  return acc.client.messages.stream(params) as unknown as ReturnType<Anthropic["beta"]["messages"]["stream"]>;
}

/** finalMessage с одной повторной попыткой без расширений, если шлюз их не принял. */
async function finalMessage(acc: Access, p: StreamParams) {
  try {
    return await openStream(acc, p).finalMessage();
  } catch (e) {
    if (acc.mode === "gateway" && e instanceof Anthropic.BadRequestError) {
      return await openStream(acc, p, true).finalMessage();
    }
    throw e;
  }
}

/** Запрос, который должен вернуть JSON. Если webSearch=true — модель ищет в интернете. */
export async function askJSON<T>(opts: {
  system?: string;
  prompt: string;
  shape: string; // описание формы JSON (TypeScript-подобное)
  webSearch?: boolean;
  effort?: Effort;
  maxTokens?: number;
  images?: string[]; // data URL (jpeg/png/webp)
}): Promise<JSONResult<T>> {
  const acc = access();
  if (!acc) throw new Error("AI не настроен");

  const system = `${opts.system ?? BASE_SYSTEM}

${jsonInstruction(opts.shape)}`;

  const tools: Anthropic.Beta.BetaToolUnion[] | undefined = opts.webSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }]
    : undefined;

  const imageBlocks: Anthropic.Beta.BetaContentBlockParam[] = (opts.images ?? []).map((url) => {
    const [head, data] = url.split(",");
    const media = (head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    return { type: "image", source: { type: "base64", media_type: media, data } };
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: imageBlocks.length ? [...imageBlocks, { type: "text", text: opts.prompt }] : opts.prompt },
  ];
  const sources: { title: string; url: string }[] = [];
  let text = "";

  // Цикл нужен для pause_turn: серверный инструмент (поиск) может приостановить ход.
  for (let i = 0; i < 4; i++) {
    const msg = await finalMessage(acc, {
      max_tokens: opts.maxTokens ?? 32000,
      system,
      effort: opts.effort ?? "medium",
      tools,
      messages,
    });

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
  const acc = access();
  if (!acc) throw new Error("AI не настроен");
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = openStream(acc, { max_tokens: 16000, system: opts.system, effort: "low", messages: opts.messages });
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
  if (err instanceof Anthropic.AuthenticationError) return aiMode() === "gateway" ? "нет доступа к AI Gateway" : "неверный ANTHROPIC_API_KEY";
  if (err instanceof Anthropic.RateLimitError) return "превышен лимит запросов, попробуй через минуту";
  if (err instanceof Anthropic.APIError) return `API ${err.status ?? ""}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── Проверка доступности AI (для статуса) ─────────────────────────────────
// Через AI Gateway доступ зависит от кредитов аккаунта Vercel, поэтому раз в
// несколько минут делаем крошечный запрос и кэшируем результат.
let _probe: { ok: boolean; at: number; error?: string } | null = null;

export async function aiReady(): Promise<{ ok: boolean; error?: string }> {
  const acc = access();
  if (!acc) return { ok: false };
  if (acc.mode === "direct") return { ok: true };
  const ttl = _probe?.ok ? 10 * 60_000 : 2 * 60_000;
  if (_probe && Date.now() - _probe.at < ttl) return _probe;
  try {
    await finalMessage(acc, { max_tokens: 16, system: "Ответь одним словом.", effort: "low", messages: [{ role: "user", content: "ok?" }] });
    _probe = { ok: true, at: Date.now() };
  } catch (e) {
    _probe = { ok: false, at: Date.now(), error: errorMessage(e) };
  }
  return _probe;
}
