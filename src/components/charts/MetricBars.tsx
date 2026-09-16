import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Metric } from "@/lib/analysis";
import { CHART, statusColorForValue, statusLabelForValue } from "@/lib/chartColors";

export default function MetricBars({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="space-y-4">
      {metrics.map((m, i) => {
        const color = statusColorForValue(m.value);
        const Icon = (Icons as any)[m.icon] ?? Icons.Circle;
        return (
          <div key={m.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Icon size={15} className="text-ink-muted" />
                <span className="font-medium">{m.label}</span>
                {m.estimated && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/5 text-ink-muted"
                    title="Нельзя измерить напрямую по доступным данным — это оценка-прокси"
                  >
                    оценка
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                {m.value}
                <span className="text-ink-muted font-normal">/100 · {statusLabelForValue(m.value)}</span>
              </span>
            </div>
            <div
              className="h-2.5 rounded-full w-full overflow-hidden"
              style={{ background: CHART.gridline }}
              role="progressbar"
              aria-valuenow={m.value}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.value}%` }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-2 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART.status.good }} /> Сильная сторона
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART.status.warning }} /> Есть куда расти
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART.status.critical }} /> Требует внимания
        </span>
      </div>
    </div>
  );
}
