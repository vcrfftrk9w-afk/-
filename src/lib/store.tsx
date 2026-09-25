"use client";
// Глобальное состояние приложения, сохраняется в localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AIAnalysis, Account, ChatMessage, GrowthPlan, LocalReport, ProductionPlan, TrendsResponse, UserSettings, VideoIdea } from "./types";
import { buildLocalReport } from "./analytics";

export interface AppStatus {
  ai: boolean;
  model: string | null;
  tiktokOAuth: boolean;
  tiktokConnected: boolean;
  webSearch?: boolean; // false в веб-версии: ИИ без доступа к интернету
  vision?: boolean; // ИИ видит изображения (скриншоты, кадры видео)
  static?: boolean; // веб-версия без своего сервера
}

export interface AppState {
  settings: UserSettings | null;
  account: Account | null;
  analysis: AIAnalysis | null;
  trends: TrendsResponse | null;
  ideas: VideoIdea[];
  scripts: Record<string, { idea: VideoIdea; plan: ProductionPlan; createdAt: number }>;
  activeScriptId: string | null;
  plan: GrowthPlan | null;
  chat: ChatMessage[];
  xp: number;
  streak: { count: number; lastDay: string | null };
}

const EMPTY: AppState = {
  settings: null,
  account: null,
  analysis: null,
  trends: null,
  ideas: [],
  scripts: {},
  activeScriptId: null,
  plan: null,
  chat: [],
  xp: 0,
  streak: { count: 0, lastDay: null },
};

const KEY = "viralpilot:v1";

interface Ctx {
  state: AppState;
  hydrated: boolean;
  status: AppStatus | null;
  report: LocalReport | null;
  update: (fn: (s: AppState) => Partial<AppState>) => void;
  reset: () => void;
  addXp: (n: number) => void;
  refreshStatus: () => Promise<void>;
}

const StoreCtx = createContext<Ctx | null>(null);

const todayKey = () => new Date().toISOString().slice(0, 10);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* пустое хранилище или приватный режим */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* квота/приватный режим */
      }
    }, 250);
  }, [state, hydrated]);

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      setStatus(await r.json());
    } catch {
      setStatus({ ai: false, model: null, tiktokOAuth: false, tiktokConnected: false });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const update = useCallback((fn: (s: AppState) => Partial<AppState>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const addXp = useCallback((n: number) => {
    setState((s) => {
      const t = todayKey();
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const streak =
        s.streak.lastDay === t
          ? s.streak
          : { count: s.streak.lastDay === y ? s.streak.count + 1 : 1, lastDay: t };
      return { ...s, xp: Math.max(0, s.xp + n), streak: n > 0 ? streak : s.streak };
    });
  }, []);

  const report = useMemo(
    () => (state.account && state.settings ? buildLocalReport(state.account, state.settings) : null),
    [state.account, state.settings],
  );

  const value = useMemo(
    () => ({ state, hydrated, status, report, update, reset, addXp, refreshStatus }),
    [state, hydrated, status, report, update, reset, addXp, refreshStatus],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export function xpLevel(xp: number) {
  // Каждый уровень требует на 25% больше XP
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = Math.round(need * 1.25);
  }
  return { level, progress: rest / need, into: rest, need };
}
