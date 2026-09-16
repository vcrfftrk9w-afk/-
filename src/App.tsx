import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Trends from "@/pages/Trends";
import Ideas from "@/pages/Ideas";
import Roadmap from "@/pages/Roadmap";
import Guide from "@/pages/Guide";
import UpdateData from "@/pages/UpdateData";
import AppShell from "@/components/layout/AppShell";

export default function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/update-data" element={<UpdateData />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
