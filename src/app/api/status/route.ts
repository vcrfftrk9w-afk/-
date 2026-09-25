import { NextResponse } from "next/server";
import { aiMode, aiReady, MODEL } from "@/lib/server/ai";
import { oauthConfigured, scanConfigured } from "@/lib/server/tiktok";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const ai = await aiReady();
  return NextResponse.json({
    ai: ai.ok,
    aiVia: ai.ok ? aiMode() : null,
    aiError: ai.ok ? undefined : ai.error,
    vision: ai.ok,
    webSearch: true,
    model: ai.ok ? MODEL : null,
    tiktokOAuth: oauthConfigured(),
    scan: "full",
    scanVia: scanConfigured() ? "apify" : "direct",
    tiktokConnected: Boolean(jar.get("tt_token")?.value),
  });
}
