import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import AnimatedBackground from "./AnimatedBackground";
import { useAppStore } from "@/store/useAppStore";

export default function AppShell() {
  const connected = useAppStore((s) => s.connected);

  if (!connected) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen">
      <AnimatedBackground />
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-24 lg:pb-10">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
