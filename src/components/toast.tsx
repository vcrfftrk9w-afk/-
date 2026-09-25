"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Kind = "ok" | "warn" | "info";
interface T {
  id: number;
  kind: Kind;
  text: string;
}

const listeners = new Set<(t: T) => void>();
let n = 0;
export function toast(text: string, kind: Kind = "ok") {
  const t = { id: ++n, kind, text };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const l = (t: T) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4200);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="glass-strong pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl"
          >
            {t.kind === "ok" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan" />}
            {t.kind === "warn" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />}
            {t.kind === "info" && <Info className="mt-0.5 size-4 shrink-0 text-violet" />}
            <span className="text-white/90">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
