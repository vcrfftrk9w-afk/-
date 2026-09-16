import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Radar,
  Lightbulb,
  Map,
  BookOpen,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getNiche } from "@/lib/niches";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { to: "/trends", label: "Радар трендов", icon: Radar },
  { to: "/ideas", label: "Идеи для видео", icon: Lightbulb },
  { to: "/roadmap", label: "План к успеху", icon: Map },
  { to: "/guide", label: "Полный гайд", icon: BookOpen },
];

export default function Sidebar() {
  const { username, niche, profile, disconnect } = useAppStore();
  const nicheInfo = niche ? getNiche(niche) : null;

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 h-screen sticky top-0 border-r border-white/5 glass !rounded-none px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="h-9 w-9 rounded-xl bg-tiktok-gradient flex items-center justify-center shadow-glow">
          <Sparkles size={18} className="text-white" />
        </div>
        <span className="font-extrabold text-lg tracking-tight">ViralCoach</span>
      </div>

      <div className="glass rounded-2xl p-3 mb-6 flex items-center gap-3">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{
            background: `linear-gradient(135deg, #FE2C55, #7c3aed, #25F4EE)`,
          }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">@{username}</p>
          <p className="text-xs text-ink-muted truncate">
            {nicheInfo?.emoji} {nicheInfo?.label} · {profile?.tier}
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-ink-secondary hover:text-white hover:bg-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <item.icon size={18} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={disconnect}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-muted hover:text-pink-glow hover:bg-white/5 transition-colors"
      >
        <LogOut size={18} />
        Отключить аккаунт
      </button>
    </aside>
  );
}
