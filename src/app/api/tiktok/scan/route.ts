import { NextRequest, NextResponse } from "next/server";
import { fetchPublicProfile, pollApifyScan, scanConfigured, scanDirect, scanWithApify, startApifyScan } from "@/lib/server/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Сканирование без ключей: профиль + последние ролики с полной статистикой. */
async function directScan(u: string, reason?: string) {
  const r = await scanDirect(u);
  return NextResponse.json({
    status: "done",
    ...r,
    mode: r.videos.length ? "full" : "profile",
    ...(reason && !r.videos.length ? { warning: `Ролики не загрузились (${reason}). Показаны цифры профиля.` } : {}),
  });
}

async function publicFallback(u: string, reason?: string) {
  try {
    return await directScan(u, reason);
  } catch {
    /* ниже — только профиль */
  }
  const r = await fetchPublicProfile(u);
  return NextResponse.json({
    status: "done",
    ...r,
    mode: r.videos.length ? "full" : "profile",
    ...(reason ? { warning: `Ролики не загрузились (${reason}). Показаны цифры профиля.` } : {}),
  });
}

/**
 * POST { u } — запускает сканирование.
 *   С APIFY_TOKEN отвечает { status: "running", runId, datasetId, username } — дальше опрашивай GET.
 *   Без токена сразу отдаёт цифры профиля: { status: "done", profile, videos, mode: "profile" }.
 */
export async function POST(req: NextRequest) {
  const { u } = (await req.json().catch(() => ({}))) as { u?: string };
  if (!u?.trim()) return NextResponse.json({ error: "Введи @username" }, { status: 400 });
  if (scanConfigured()) {
    try {
      return NextResponse.json({ status: "running", found: 0, ...(await startApifyScan(u)) });
    } catch (e) {
      try {
        return await publicFallback(u, (e as Error).message);
      } catch {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
      }
    }
  }
  try {
    return await publicFallback(u);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/**
 * GET ?run=&dataset=&u= — статус запуска: { status: "running", found } | { status: "done", profile, videos } | { status: "failed", error }.
 * GET ?u= — синхронное сканирование целиком (для обновления данных).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const u = sp.get("u") ?? "";
  const run = sp.get("run");
  const dataset = sp.get("dataset");
  if (run && dataset) {
    try {
      const p = await pollApifyScan(run, dataset, u);
      if (p.status === "done") return NextResponse.json({ ...p, mode: "full" });
      if (p.status === "failed") {
        try {
          return await publicFallback(u, p.error);
        } catch {
          return NextResponse.json({ status: "failed", error: p.error });
        }
      }
      return NextResponse.json(p);
    } catch (e) {
      return NextResponse.json({ status: "failed", error: (e as Error).message });
    }
  }
  if (scanConfigured()) {
    try {
      return NextResponse.json({ status: "done", ...(await scanWithApify(u)), mode: "full" });
    } catch (e) {
      try {
        return await publicFallback(u, (e as Error).message);
      } catch {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
      }
    }
  }
  try {
    return await publicFallback(u);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
