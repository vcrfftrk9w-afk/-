import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { GUIDE_SECTIONS } from "@/lib/guide";

export default function Guide() {
  const [openId, setOpenId] = useState<string | null>(GUIDE_SECTIONS[0].id);

  return (
    <div>
      <PageHeader
        eyebrow="База знаний"
        title="Полный гайд: как стать популярным в TikTok"
        subtitle="Всё, что нужно знать про алгоритм, хуки, тренды, съёмку и аналитику — собрано в одном месте"
      />

      <div className="space-y-3">
        {GUIDE_SECTIONS.map((section, i) => {
          const Icon = (Icons as any)[section.icon] ?? Icons.BookOpen;
          const open = openId === section.id;
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass rounded-2xl overflow-hidden shadow-card"
            >
              <button
                onClick={() => setOpenId(open ? null : section.id)}
                className="w-full flex items-center gap-4 p-5 text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-tiktok-gradient/20 flex items-center justify-center shrink-0 text-cyan-glow">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">{section.title}</h3>
                  {!open && (
                    <p className="text-xs text-ink-muted mt-0.5 truncate">{section.intro}</p>
                  )}
                </div>
                <motion.div animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-ink-muted">
                  <ChevronDown size={18} />
                </motion.div>
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pl-[76px]">
                      <p className="text-sm text-ink-secondary mb-3">{section.intro}</p>
                      <ul className="space-y-2">
                        {section.points.map((point, pi) => (
                          <li key={pi} className="text-sm text-ink-secondary flex gap-2">
                            <span className="text-cyan-glow shrink-0">✓</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
