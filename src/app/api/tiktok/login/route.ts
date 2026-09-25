import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, oauthConfigured } from "@/lib/server/tiktok";

export async function GET(req: NextRequest) {
  if (!oauthConfigured()) {
    return NextResponse.redirect(new URL("/?error=oauth_not_configured", req.url));
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state, req.nextUrl.origin));
  res.cookies.set("tt_state", state, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 600, path: "/" });
  return res;
}
