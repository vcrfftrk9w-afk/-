import { motion } from "framer-motion";
import { ContentPillar } from "@/lib/analysis";
import { CHART } from "@/lib/chartColors";

export default function PillarsChart({ pillars }: { pillars: ContentPillar[] }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART.seriesBlue }} /> Сейчас
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART.seriesOrange }} /> Рекомендуемый баланс
        </span>
      </div>
      <div className="space-y-4">
        {pillars.map((p, i) => (
          <div key={p.name}>
            <div className="flex items-center justify-between mb-1.5 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-ink-muted tabular-nums">
                {p.share}% · цель {p.idealShare}%
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-[#2c2c2a] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${p.share}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className="h-full rounded-full absolute inset-y-0 left-0"
                style={{ background: CHART.seriesBlue }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-[2px] rounded-full"
                style={{ left: `${p.idealShare}%`, background: CHART.seriesOrange }}
                title={`Цель: ${p.idealShare}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
