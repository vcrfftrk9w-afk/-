import { NextResponse } from "next/server";
import type { Account, UserSettings } from "../types";
import { buildLocalReport } from "../analytics";
import { aiEnabled, errorMessage } from "./ai";

export interface BaseBody {
  settings: UserSettings;
  account?: Account | null;
}

export async function readBody<T extends BaseBody>(req: Request): Promise<T & { report: ReturnType<typeof buildLocalReport> | null }> {
  const body = (await req.json()) as T;
  if (!body?.settings) throw new Error("settings required");
  const report = body.account ? buildLocalReport(body.account, body.settings) : null;
  return { ...body, report };
}

/** Выполняет AI-функцию, при отсутствии ключа или ошибке — офлайн-фолбэк. */
export async function aiOrLocal<T>(ai: () => Promise<T>, local: () => T) {
  if (!aiEnabled()) return NextResponse.json({ data: local(), mode: "local" });
  try {
    return NextResponse.json({ data: await ai(), mode: "ai" });
  } catch (e) {
    console.error("[AI]", e);
    return NextResponse.json({ data: local(), mode: "local", warning: `AI недоступен (${errorMessage(e)}), показан офлайн-результат` });
  }
}

export const today = () => new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
export const rid = () => Math.random().toString(36).slice(2, 10);
