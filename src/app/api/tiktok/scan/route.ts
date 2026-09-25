import { NextRequest, NextResponse } from "next/server";
import { fetchPublicProfile, scanConfigured, scanWithApify } from "@/lib/server/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Сканирует аккаунт по @username: профиль + последние ролики со статистикой. */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  if (scanConfigured()) {
    try {
      const r = await scanWithApify(u);
      return NextResponse.json({ ...r, mode: "full" });
    } catch (e) {
      // Сканер не справился — пробуем хотя бы публичные цифры профиля
      try {
        const r = await fetchPublicProfile(u);
        return NextResponse.json({ ...r, mode: "profile", warning: `Ролики не загрузились (${(e as Error).message}). Показаны цифры профиля.` });
      } catch {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
      }
    }
  }
  try {
    const r = await fetchPublicProfile(u);
    return NextResponse.json({ ...r, mode: r.videos.length ? "full" : "profile" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
