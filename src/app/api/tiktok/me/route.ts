import { NextRequest, NextResponse } from "next/server";
import { fetchOwnProfile, fetchOwnVideos, refreshToken, type TokenSet } from "@/lib/server/tiktok";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get("tt_token")?.value;
  if (!raw) return NextResponse.json({ error: "Аккаунт TikTok не подключён" }, { status: 401 });
  let tokens: TokenSet;
  try {
    tokens = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Повреждён токен, войди заново" }, { status: 401 });
  }
  let refreshed = false;
  try {
    if (Date.now() > tokens.expires_at - 60_000) {
      tokens = await refreshToken(tokens.refresh_token);
      refreshed = true;
    }
    const [profile, videos] = await Promise.all([fetchOwnProfile(tokens.access_token), fetchOwnVideos(tokens.access_token)]);
    const res = NextResponse.json({ profile, videos });
    if (refreshed) {
      res.cookies.set("tt_token", JSON.stringify(tokens), { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 365, path: "/" });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
