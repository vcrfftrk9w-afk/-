import { useState } from "react";
import { HeatCell } from "@/lib/analysis";
import { CHART } from "@/lib/chartColors";

const SLOT_ORDER = ["06–10", "10–14", "14–18", "18–22", "22–02"];

function colorFor(value: number) {
  const ramp = CHART.sequentialBlue;
  const idx = Math.min(ramp.length - 1, Math.floor((value / 100) * ramp.length));
  return ramp[idx];
}

export default function PostingHeatmap({
  data,
  bestSlot,
}: {
  data: HeatCell[];
  bestSlot: { day: string; slot: string };
}) {
  const [hover, setHover] = useState<HeatCell | null>(null);
  const days = Array.from(new Set(data.map((d) => d.day)));

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 mb-1">
            <div />
            {SLOT_ORDER.map((s) => (
              <div key={s} className="text-center text-[10px] text-ink-muted font-medium">
                {s}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 mb-1">
              <div className="text-[11px] text-ink-muted font-medium flex items-center">{day}</div>
              {SLOT_ORDER.map((slot) => {
                const cell = data.find((d) => d.day === day && d.slot === slot);
                if (!cell) return <div key={slot} />;
                const isBest = bestSlot.day === day && bestSlot.slot === slot;
                return (
                  <button
                    key={slot}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    className="relative aspect-square rounded-md transition-transform hover:scale-110"
                    style={{
                      background: colorFor(cell.value),
                      outline: isBest ? `2px solid ${CHART.status.good}` : undefined,
                      outlineOffset: isBest ? 1 : undefined,
                    }}
                    aria-label={`${day} ${slot}: вовлечённость ${cell.value}`}
                  >
                    {isBest && (
                      <span className="absolute -top-1.5 -right-1.5 text-[10px]">⭐</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span>Меньше</span>
          {CHART.sequentialBlue.slice(0, 5).map((c, i) => (
            <span key={i} className="h-3 w-3 rounded-sm" style={{ background: c }} />
          ))}
          <span>Больше</span>
        </div>
        {hover ? (
          <p className="text-xs font-medium">
            {hover.day}, {hover.slot} — {hover.value}/100
          </p>
        ) : (
          <p className="text-xs text-good font-medium">
            ⭐ Лучшее время: {bestSlot.day}, {bestSlot.slot}
          </p>
        )}
      </div>
    </div>
  );
}
