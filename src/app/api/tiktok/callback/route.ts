import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/server/tiktok";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const saved = req.cookies.get("tt_state")?.value;

  if (err) return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err)}`, req.url));
  if (!code || !state || state !== saved) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }
  try {
    const tokens = await exchangeCode(code, url.origin);
    const res = NextResponse.redirect(new URL("/?connected=tiktok", req.url));
    res.cookies.set("tt_token", JSON.stringify(tokens), {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    res.cookies.delete("tt_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent((e as Error).message)}`, req.url));
  }
}
