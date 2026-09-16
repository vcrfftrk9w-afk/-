import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GrowthPoint } from "@/lib/analysis";
import { CHART } from "@/lib/chartColors";

export default function GrowthLineChart({
  data,
  unitLabel = "подписчиков",
}: {
  data: GrowthPoint[];
  unitLabel?: string;
}) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, maxV, minV } = useMemo(() => {
    if (data.length < 2) return { points: [], maxV: 0, minV: 0 };
    const values = data.map((d) => d.followers);
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * innerW;
      const range = maxV - minV || 1;
      const y = padding.top + innerH - ((d.followers - minV) / range) * innerH;
      return { x, y, ...d };
    });
    return { points, maxV, minV };
  }, [data]);

  if (points.length < 2) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-center gap-1.5 text-ink-muted">
        <p className="text-sm font-medium">Недостаточно данных для графика</p>
        <p className="text-xs">Добавь ещё видео с датами публикации</p>
      </div>
    );
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1].x},${height - padding.bottom} L${points[0].x},${height - padding.bottom} Z`;

  const gridLines = 4;
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relX = (x / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIdx(closest);
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.seriesBlue} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART.seriesBlue} stopOpacity={0} />
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padding.top + (i / gridLines) * (height - padding.top - padding.bottom);
          const v = maxV - (i / gridLines) * (maxV - minV);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke={CHART.gridline}
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill={CHART.textMuted}
              >
                {formatCompact(v)}
              </text>
            </g>
          );
        })}

        <motion.path
          d={areaPath}
          fill="url(#growthFill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke={CHART.seriesBlue}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />

        {points.map((p, i) =>
          i === points.length - 1 || i === hoverIdx ? (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill={CHART.seriesBlue} stroke={CHART.surface} strokeWidth={2} />
          ) : null,
        )}

        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke={CHART.axis}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        <text
          x={points[points.length - 1].x}
          y={points[points.length - 1].y - 12}
          textAnchor="end"
          fontSize={11}
          fontWeight={700}
          fill={CHART.textPrimary}
        >
          {points[points.length - 1].followers.toLocaleString("ru-RU")}
        </text>

        <rect
          x={padding.left}
          y={0}
          width={width - padding.left - padding.right}
          height={height}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>

      {hovered && (
        <div
          className="absolute glass rounded-lg px-2.5 py-1.5 text-xs pointer-events-none -translate-x-1/2"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: 0,
          }}
        >
          <p className="text-ink-muted">{hovered.label}</p>
          <p className="font-bold tabular-nums">
            {hovered.followers.toLocaleString("ru-RU")} {unitLabel}
          </p>
        </div>
      )}
    </div>
  );
}

function formatCompact(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toString();
}
