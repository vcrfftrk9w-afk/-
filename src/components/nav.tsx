"use client";
import { createContext, useContext } from "react";

export type TabId = "overview" | "analysis" | "trends" | "ideas" | "studio" | "plan" | "coach" | "tools" | "settings";

export interface NavCtx {
  tab: TabId;
  go: (t: TabId, opts?: { focus?: string }) => void;
  pendingFocus: string | null;
  clearFocus: () => void;
}

export const Nav = createContext<NavCtx>({ tab: "overview", go: () => {}, pendingFocus: null, clearFocus: () => {} });
export const useNav = () => useContext(Nav);
