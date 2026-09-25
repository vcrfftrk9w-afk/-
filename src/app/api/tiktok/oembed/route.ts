import { NextRequest, NextResponse } from "next/server";
import { fetchOEmbed } from "@/lib/server/tiktok";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!/tiktok\.com\//i.test(url)) return NextResponse.json({ error: "Нужна ссылка на видео TikTok" }, { status: 400 });
  try {
    return NextResponse.json(await fetchOEmbed(url));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
