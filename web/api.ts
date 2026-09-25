// ─────────────────────────────────────────────────────────────────────────────
// Веб-версия без своего сервера: перехватывает запросы приложения к /api/*
// и выполняет их прямо в браузере. ИИ — Claude через capability `sample`
// (на аккаунте зрителя, с его согласия); без него — офлайн-движок.
// ─────────────────────────────────────────────────────────────────────────────
import { buildLocalReport } from "@/lib/analytics";
import { getNiche } from "@/lib/knowledge";
import { localAnalysis, localCoachReply, localGrowthPlan, localIdeas, localProductionPlan, localReview, localTool, localTrends } from "@/lib/offline";
import { normalizePlan, type RawPlan } from "@/lib/plan";
import {
  ANALYZE_SHAPE,
  BASE_SYSTEM,
  IDEAS_SHAPE,
  PLAN_SHAPE,
  REVIEW_SHAPE,
  SCRIPT_SHAPE,
  TOOL_SHAPE,
  TOOL_TASKS,
  TRENDS_SHAPE,
  analyzePrompt,
  coachSystem,
  ideasPrompt,
  jsonInstruction,
  planPrompt,
  reviewPrompt,
  scriptPrompt,
  toolPrompt,
  trendsPrompt,
} from "@/lib/prompts";
import { creatorBrief } from "@/lib/server/context";
import type { Account, AIAnalysis, ChatMessage, ProductionPlan, Trend, TrendsResponse, UserSettings, VideoIdea } from "@/lib/types";

// ── Доступ к Claude на странице ─────────────────────────────────────────────
type Tier = "default" | "complex" | "quick";
interface SampleOpts {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  modelTier?: Tier;
  cache?: boolean;
}
type Turn = { role: "user" | "assistant"; content: string };
interface Sample {
  (input: string | Turn[], opts?: SampleOpts): Promise<{ text: string; truncated: boolean }>;
  json<T>(input: string | Turn[], opts?: SampleOpts): Promise<T>;
}
interface SampleError {
  code: string;
  message: string;
  text?: string;
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
    __VP_STATIC__?: boolean;
  }
}

let samplePromise: Promise<Sample | null> | null = null;
function getSample(): Promise<Sample | null> {
  if (!samplePromise) {
    samplePromise = window.claude?.use ? (window.claude.use("sample") as Promise<Sample | null>).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

const BLOCKING = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);
let aiBlocked = false;

class NoAI extends Error {}

function describe(e: unknown): string {
  const code = (e as SampleError)?.code;
  switch (code) {
    case "not_granted":
      return "Ты не разрешил(а) странице обращаться к Claude";
    case "sampling_disabled":
      return "Claude недоступен для этого аккаунта";
    case "rate_limited":
      return "слишком много запросов к Claude, попробуй чуть позже";
    case "session_expired":
      return "нужно заново войти в Claude";
    case "invalid_json":
      return "ИИ ответил не в том формате";
    case "refused":
      return "Claude отказался отвечать на этот запрос";
    default:
      return (e as SampleError)?.message || (e as Error)?.message || "ошибка ИИ";
  }
}

async function aiJSON<T>(prompt: string, shape: string, opts: { tier?: Tier; fresh?: boolean } = {}): Promise<T> {
  const s = await getSample();
  if (!s || aiBlocked) throw new NoAI();
  try {
    return await s.json<T>(`${BASE_SYSTEM}\n\n${prompt}\n\n${jsonInstruction(shape)}`, {
      modelTier: opts.tier ?? "default",
      ...(opts.fresh ? { cache: false } : {}),
    });
  } catch (e) {
    if (BLOCKING.has((e as SampleError)?.code)) aiBlocked = true;
    throw e;
  }
}

async function aiOrLocal<T>(ai: () => Promise<T>, local: () => T) {
  try {
    return { data: await ai(), mode: "ai" as const };
  } catch (e) {
    if (e instanceof NoAI) return { data: local(), mode: "local" as const };
    return { data: local(), mode: "local" as const, warning: `${describe(e)} — показан офлайн-результат` };
  }
}

// ── Обработчики /api/* ──────────────────────────────────────────────────────
interface Body {
  settings: UserSettings;
  account?: Account | null;
  [k: string]: unknown;
}

const rid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function handleAI(name: string, body: Body): Promise<Response> {
  const { settings } = body;
  const account = body.account ?? null;
  const report = account ? buildLocalReport(account, settings) : null;
  const brief = creatorBrief(settings, account, report);

  switch (name) {
    case "analyze": {
      if (!account || !report) return json({ error: "Нет данных аккаунта" }, 400);
      return json(
        await aiOrLocal<AIAnalysis>(
          async () => ({ ...(await aiJSON<Omit<AIAnalysis, "source">>(analyzePrompt(brief), ANALYZE_SHAPE)), source: "ai" }),
          () => localAnalysis(account, settings, report),
        ),
      );
    }
    case "trends": {
      const niche = getNiche(settings.niche);
      const focus = body.focus as string | undefined;
      return json(
        await aiOrLocal<TrendsResponse>(
          async () => {
            const d = await aiJSON<{ trends: Omit<Trend, "id">[]; note: string }>(
              trendsPrompt({ today: today(), nicheLabel: niche.label, subNiche: settings.subNiche, region: settings.region, focus, brief, web: false }),
              TRENDS_SHAPE,
              { fresh: true },
            );
            return { trends: (d.trends ?? []).map((t) => ({ ...t, id: rid() })), fetchedAt: Date.now(), live: false, origin: "ai", note: d.note };
          },
          () => localTrends(settings),
        ),
      );
    }
    case "ideas": {
      const n = Math.min(Math.max(Number(body.count) || 8, 3), 12);
      const trends = (body.trends as Trend[]) ?? [];
      return json(
        await aiOrLocal<VideoIdea[]>(
          async () => {
            const d = await aiJSON<{ ideas: Omit<VideoIdea, "id">[] }>(
              ideasPrompt({ n, focus: body.focus as string | undefined, exclude: (body.exclude as string[]) ?? [], trends, brief }),
              IDEAS_SHAPE,
              { fresh: true },
            );
            return (d.ideas ?? []).map((i) => ({ ...i, id: rid() })).sort((a, b) => b.viralPotential - a.viralPotential);
          },
          () => localIdeas(settings, report, trends, n),
        ),
      );
    }
    case "script": {
      const idea = body.idea as VideoIdea;
      if (!idea) return json({ error: "Нет идеи" }, 400);
      return json(
        await aiOrLocal<ProductionPlan>(
          async () => ({ ...(await aiJSON<Omit<ProductionPlan, "source">>(scriptPrompt(idea, brief), SCRIPT_SHAPE)), source: "ai" }),
          () => localProductionPlan(idea, settings, report),
        ),
      );
    }
    case "plan":
      return json(await aiOrLocal(async () => normalizePlan(await aiJSON<RawPlan>(planPrompt(brief), PLAN_SHAPE, { fresh: true })), () => localGrowthPlan(settings, report)));
    case "tool": {
      const tool = String(body.tool);
      const task = TOOL_TASKS[tool];
      if (!task) return json({ error: "Неизвестный инструмент" }, 400);
      const topic = String(body.topic ?? "");
      return json(
        await aiOrLocal(
          async () => (await aiJSON<{ items: string[] }>(toolPrompt(task, topic, brief), TOOL_SHAPE, { tier: "quick", fresh: true })).items ?? [],
          () => localTool(tool === "rewrite" || tool === "names" ? "hooks" : tool, topic, settings),
        ),
      );
    }
    case "review": {
      const description = String(body.description ?? "");
      const meta = body.meta as { title?: string } | undefined;
      const stats = body.stats as Parameters<typeof localReview>[2];
      return json(
        await aiOrLocal(
          () => aiJSON(reviewPrompt({ description, metaTitle: meta?.title, stats, brief }), REVIEW_SHAPE),
          () => localReview(`${meta?.title ?? ""} ${description}`.trim(), settings.niche, stats),
        ),
      );
    }
    case "chat":
      return chat(body, brief, report);
  }
  return json({ error: "Не найдено" }, 404);
}

async function chat(body: Body, brief: string, report: ReturnType<typeof buildLocalReport> | null): Promise<Response> {
  const history = ((body.messages as ChatMessage[]) ?? []).filter((m) => m.content.trim()).slice(-16);
  while (history.length && history[0].role !== "user") history.shift();
  const last = history[history.length - 1]?.content ?? "";
  const s = await getSample();
  const enc = new TextEncoder();

  if (!s || aiBlocked) {
    return new Response(localCoachReply(last, body.settings, report), { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Mode": "local" } });
  }

  const turns: Turn[] = [{ role: "user", content: `${coachSystem(brief)}\n\nДальше — наш диалог. Отвечай на последнее сообщение автора.` }, ...history];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await s(turns, { cache: false, onText: ({ delta }) => controller.enqueue(enc.encode(delta)) });
      } catch (e) {
        const code = (e as SampleError)?.code;
        if (BLOCKING.has(code)) aiBlocked = true;
        if (code !== "cancelled") {
          const offline = BLOCKING.has(code) ? `\n\n${localCoachReply(last, body.settings, report)}` : "";
          controller.enqueue(enc.encode(`\n\n⚠️ ${describe(e)}.${offline}`));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Mode": "ai" } });
}

async function handle(path: string, init?: RequestInit): Promise<Response> {
  if (path === "/api/status") {
    const s = await getSample();
    return json({ ai: Boolean(s) && !aiBlocked, model: s ? "Claude" : null, tiktokOAuth: false, tiktokConnected: false, webSearch: false, static: true });
  }
  if (path === "/api/tiktok/public") return json({ error: "В веб-версии TikTok не отдаёт профиль по нику" }, 502);
  if (path === "/api/tiktok/oembed") return json({ error: "в веб-версии ссылки на видео не открываются" }, 502);
  if (path === "/api/tiktok/me") return json({ error: "Вход через TikTok доступен в полной версии приложения" }, 401);
  if (path === "/api/tiktok/logout") return json({ ok: true });
  if (path.startsWith("/api/ai/")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    if (!body.settings) return json({ error: "settings required" }, 400);
    return handleAI(path.slice("/api/ai/".length), body);
  }
  return json({ error: "Не найдено" }, 404);
}

export function installApiShim() {
  window.__VP_STATIC__ = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith("/") ? url.split("?")[0] : null;
    if (path?.startsWith("/api/")) return handle(path, init);
    return original(input, init);
  };
}
