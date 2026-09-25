"use client";
import type { Account, UserSettings } from "./types";

export interface ApiResult<T> {
  data: T;
  mode: "ai" | "local";
  warning?: string;
}

export async function callAI<T>(path: string, body: { settings: UserSettings; account?: Account | null } & Record<string, unknown>): Promise<ApiResult<T>> {
  const res = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: `Ошибка ${res.status}` }));
  if (!res.ok || json.error) throw new Error(json.error || `Ошибка ${res.status}`);
  return json as ApiResult<T>;
}

export async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({ error: `Ошибка ${res.status}` }));
  if (!res.ok || json.error) throw new Error(json.error || `Ошибка ${res.status}`);
  return json as T;
}
