"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Bot, Clapperboard, Flame, LayoutDashboard, Lightbulb, Settings, Target, Wand2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aurora, Confetti, Logo, Progress, cn } from "@/components/ui";
import { Nav, type TabId } from "@/components/nav";
import { useStore, xpLevel } from "@/lib/store";
import { Overview } from "@/components/tabs/overview";
import { Analysis } from "@/components/tabs/analysis";
import { Trends } from "@/components/tabs/trends";
import { Ideas } from "@/components/tabs/ideas";
import { Studio } from "@/components/tabs/studio";
import { Plan } from "@/components/tabs/plan";
import { Coach } from "@/components/tabs/coach";
import { Tools } from "@/components/tabs/tools";
import { SettingsTab } from "@/components/tabs/settings";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "analysis", label: "Анализ", icon: BarChart3 },
  { id: "trends", label: "Тренды", icon: Flame },
  { id: "ideas", label: "Идеи", icon: Lightbulb },
  { id: "studio", label: "Студия", icon: Clapperboard },
  { id: "plan", label: "План", icon: Target },
  { id: "coach", label: "AI-коуч", icon: Bot },
  { id: "tools", label: "Инструменты", icon: Wand2 },
  { id: "settings", label: "Профиль", icon: Settings },
];

const TAB_IDS = TABS.map((t) => t.id);

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, hydrated, status } = useStore();
  const initial = params.get("tab") as TabId | null;
  const [tab, setTab] = useState<TabId>(initial && TAB_IDS.includes(initial) ? initial : "overview");
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && (!state.account || !state.settings)) router.replace("/");
  }, [hydrated, state.account, state.settings, router]);

  const go = useCallback((t: TabId, opts?: { focus?: string }) => {
    setTab(t);
    setPendingFocus(opts?.focus ?? null);
    try {
      if (!(window as { __VP_STATIC__?: boolean }).__VP_STATIC__) window.history.replaceState(null, "", `/dashboard?tab=${t}`);
    } catch {
      /* адрес страницы менять нельзя — не важно */
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const clearFocus = useCallback(() => setPendingFocus(null), []);

  if (!hydrated || !state.account || !state.settings) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Aurora />
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
          <Logo size={48} />
        </motion.div>
      </div>
    );
  }

  const lv = xpLevel(state.xp);
  const p = state.account.profile;

  return (
    <Nav.Provider value={{ tab, go, pendingFocus, clearFocus }}>
      <Aurora />
      <Confetti />
      <div className="flex min-h-dvh">
        {/* Сайдбар */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-black/20 p-4 backdrop-blur-xl lg:flex">
          <div className="px-2 py-2">
            <Logo />
          </div>
          <nav className="mt-6 flex-1 space-y-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={cn("relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition", tab === t.id ? "text-white" : "text-white/55 hover:text-white")}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="navActive"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink/25 to-violet/15 ring-1 ring-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <t.icon className="relative size-[18px]" />
                <span className="relative">{t.label}</span>
                {t.id === "trends" && status?.ai && status.webSearch !== false && <span className="relative ml-auto rounded-full bg-lime/15 px-1.5 py-0.5 text-[9px] font-bold text-lime">LIVE</span>}
                {t.id === "studio" && Object.keys(state.scripts).length > 0 && (
                  <span className="relative ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">{Object.keys(state.scripts).length}</span>
                )}
              </button>
            ))}
          </nav>
          <button onClick={() => go("settings")} className="glass rounded-2xl p-3 text-left transition hover:bg-white/5">
            <div className="flex items-center gap-3">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-pink text-sm font-bold">{p.username[0]?.toUpperCase()}</div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">@{p.username}</div>
                <div className="text-xs text-white/45">
                  Уровень {lv.level} · 🔥 {state.streak.count} дн.
                </div>
              </div>
            </div>
            <Progress value={lv.progress * 100} className="mt-3 h-1.5" />
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <Logo size={30} />
            <button onClick={() => go("settings")} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70">
              Ур. {lv.level} · 🔥{state.streak.count}
            </button>
          </div>
          <div className="mx-auto max-w-6xl">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === "overview" && <Overview />}
                {tab === "analysis" && <Analysis />}
                {tab === "trends" && <Trends />}
                {tab === "ideas" && <Ideas />}
                {tab === "studio" && <Studio />}
                {tab === "plan" && <Plan />}
                {tab === "coach" && <Coach />}
                {tab === "tools" && <Tools />}
                {tab === "settings" && <SettingsTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Мобильная навигация */}
      <nav className="glass-strong fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 overflow-x-auto rounded-3xl px-2 py-2 no-scrollbar lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            className={cn("relative flex min-w-[62px] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-semibold", tab === t.id ? "text-white" : "text-white/45")}
          >
            {tab === t.id && <motion.div layoutId="navMobile" className="absolute inset-0 rounded-2xl bg-white/10" />}
            <t.icon className="relative size-5" />
            <span className="relative whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </nav>
    </Nav.Provider>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
