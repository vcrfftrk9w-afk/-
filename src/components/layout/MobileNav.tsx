import { NavLink } from "react-router-dom";
import { LayoutDashboard, Radar, Lightbulb, Map, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { to: "/trends", label: "Тренды", icon: Radar },
  { to: "/ideas", label: "Идеи", icon: Lightbulb },
  { to: "/roadmap", label: "План", icon: Map },
  { to: "/guide", label: "Гайд", icon: BookOpen },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass !rounded-none border-t border-white/10 px-2 py-2 flex justify-around">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium ${
              isActive ? "text-cyan-glow" : "text-ink-muted"
            }`
          }
        >
          <item.icon size={20} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
