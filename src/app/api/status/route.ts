import { NextResponse } from "next/server";
import { aiEnabled, MODEL } from "@/lib/server/ai";
import { oauthConfigured } from "@/lib/server/tiktok";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    ai: aiEnabled(),
    model: aiEnabled() ? MODEL : null,
    tiktokOAuth: oauthConfigured(),
    tiktokConnected: Boolean(jar.get("tt_token")?.value),
  });
}
