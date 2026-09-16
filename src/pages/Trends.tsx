import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Music2, ChevronDown, Clock, Gauge } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/ui/PageHeader";
import { getTrendsForNiche, MOMENTUM_META, Momentum, Trend } from "@/lib/trends";
import { CHART } from "@/lib/chartColors";

const MOMENTUM_FILTERS: { id: Momentum | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "rising", label: "Растёт 🚀" },
  { id: "peaking", label: "На пике 🔥" },
  { id: "fading", label: "Угасает" },
];

export default function Trends() {
  const profile = useAppStore((s) => s.profile);
  const [filter, setFilter] = useState<Momentum | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const trends = useMemo(() => {
    if (!profile) return [];
    const all = getTrendsForNiche(profile.niche);
    return filter === "all" ? all : all.filter((t) => t.momentum === filter);
  }, [profile, filter]);

  if (!profile) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Радар трендов"
        title="Что сейчас взлетает в твоей нише"
        subtitle="Актуальные форматы, звуки и челленджи — с пошаговой инструкцией по съёмке для каждого"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {MOMENTUM_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              filter === f.id
                ? "bg-white/10 border-white/20 text-white"
                : "border-white/10 text-ink-muted hover:text-white hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {trends.map((trend, i) => (
          <TrendCard
            key={trend.id}
            trend={trend}
            index={i}
            open={openId === trend.id}
            onToggle={() => setOpenId(openId === trend.id ? null : trend.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TrendCard({
  trend,
  index,
  open,
  onToggle,
}: {
  trend: Trend;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const momentum = MOMENTUM_META[trend.momentum];
  const dotColor =
    momentum.color === "good"
      ? CHART.status.good
      : momentum.color === "warning"
        ? CHART.status.warning
        : CHART.textMuted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl shadow-card overflow-hidden"
    >
      <button onClick={onToggle} className="w-full text-left p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 text-cyan-glow">
          <Flame size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold">{trend.title}</h3>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/5"
              style={{ color: dotColor }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
              {momentum.label}
            </span>
          </div>
          <p className="text-sm text-ink-secondary">{trend.description}</p>
          <div className="flex items-center gap-4 mt-2.5 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <Gauge size={13} /> {trend.difficulty}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} /> {trend.timeToFilm}
            </span>
            <span className="flex items-center gap-1">
              <Music2 size={13} /> {trend.category}
            </span>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-ink-muted mt-1">
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
            <div className="px-5 pb-5 pt-1 border-t border-white/5 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-cyan-glow mb-2 uppercase tracking-wide">
                  Как снять: шаг за шагом
                </p>
                <ol className="space-y-2">
                  {trend.howTo.map((step, i) => (
                    <li key={i} className="text-sm text-ink-secondary flex gap-2">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-white/5 text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-1 uppercase tracking-wide">Звук</p>
                  <p className="text-sm text-ink-secondary">{trend.audioHint}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-1 uppercase tracking-wide">Пример подписи</p>
                  <p className="text-sm text-ink-secondary italic">"{trend.captionExample}"</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wide">Хэштеги</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trend.hashtags.map((h) => (
                      <span key={h} className="text-xs px-2 py-0.5 rounded-full bg-cyan-glow/10 text-cyan-glow">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
