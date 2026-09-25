import { NextRequest, NextResponse } from "next/server";
import { fetchPublicProfile } from "@/lib/server/tiktok";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  try {
    return NextResponse.json(await fetchPublicProfile(u));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
