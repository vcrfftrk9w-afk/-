import { NextResponse } from "next/server";
import { aiEnabled, MODEL } from "@/lib/server/ai";
import { oauthConfigured, scanConfigured } from "@/lib/server/tiktok";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    ai: aiEnabled(),
    vision: aiEnabled(),
    webSearch: true,
    model: aiEnabled() ? MODEL : null,
    tiktokOAuth: oauthConfigured(),
    scan: scanConfigured() ? "full" : "profile",
    tiktokConnected: Boolean(jar.get("tt_token")?.value),
  });
}
