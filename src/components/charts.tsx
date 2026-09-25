"use client";
// Графики. Палитра проверена валидатором (тёмный фон #0f0f18):
// серия A = #14a8a4 (бирюзовый), серия B = #fe2c55 (розовый). Одна ось Y на график.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNum } from "@/lib/analytics";
import { DAYS_RU } from "@/lib/knowledge";
import type { HeatCell } from "@/lib/types";

export const SERIES_A = "#14a8a4";
export const SERIES_B = "#fe2c55";
const AXIS = { stroke: "rgba(255,255,255,0.35)", fontSize: 11 };
const GRID = "rgba(255,255,255,0.06)";

function Tip({ active, payload, label, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: Record<string, unknown> }[]; label?: string | number; labelFmt?: (l: string | number, p?: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-white/55">{labelFmt ? labelFmt(label ?? "", payload[0].payload) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70">{p.name}:</span>
          <span className="font-semibold text-white">{formatNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ForecastChart({ data, goal }: { data: { day: number; current: number; withPlan: number }[]; goal: number }) {
  const last = data[data.length - 1];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-white/60">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded" style={{ background: SERIES_B }} /> С планом ViralPilot · {formatNum(last?.withPlan ?? 0)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded" style={{ background: SERIES_A }} /> Как сейчас · {formatNum(last?.current ?? 0)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t border-dashed border-white/50" /> Цель {formatNum(goal)}
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_B} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES_B} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_A} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES_A} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(d) => `${d}д`} interval={14} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatNum(v)} width={52} />
            <Tooltip content={<Tip labelFmt={(l) => `День ${l}`} />} cursor={{ stroke: "rgba(255,255,255,0.25)" }} />
            {goal > 0 && <ReferenceLine y={goal} stroke="rgba(255,255,255,0.45)" strokeDasharray="4 4" />}
            <Area type="monotone" dataKey="current" name="Как сейчас" stroke={SERIES_A} strokeWidth={2} fill="url(#gCur)" dot={false} activeDot={{ r: 5, stroke: "#0f0f18", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="withPlan" name="С планом" stroke={SERIES_B} strokeWidth={2} fill="url(#gPlan)" dot={false} activeDot={{ r: 5, stroke: "#0f0f18", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ViewsChart({ data, median }: { data: { date: string; views: number; title: string }[]; median: number }) {
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatNum(v)} width={52} />
          <Tooltip content={<Tip labelFmt={(l, p) => `${l} · ${String(p?.title ?? "").slice(0, 50)}`} />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
          <ReferenceLine y={median} stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" />
          <Bar dataKey="views" name="Просмотры" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.views > median * 3 ? SERIES_B : SERIES_A} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DurationChart({ data }: { data: { label: string; avgViews: number; count: number }[] }) {
  const best = Math.max(...data.map((d) => d.avgViews));
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatNum(v)} width={52} />
          <Tooltip content={<Tip labelFmt={(l, p) => `${l} · ${p?.count ?? 0} видео`} />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
          <Bar dataKey="avgViews" name="Средние просмотры" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.avgViews === best && best > 0 ? SERIES_B : SERIES_A} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Тепловая карта: день недели × час. Одна последовательная шкала (розовый, от светлого к насыщенному). */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const map = new Map(cells.map((c) => [`${c.day}-${c.hour}`, c]));
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[560px]">
        <div className="ml-8 grid grid-cols-[repeat(24,1fr)] gap-[2px] pb-1 text-[10px] text-white/35">
          {hours.map((h) => (
            <div key={h} className="text-center">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {DAYS_RU.map((d, di) => (
          <div key={d} className="mb-[2px] flex items-center">
            <div className="w-8 text-[11px] text-white/45">{d}</div>
            <div className="grid flex-1 grid-cols-[repeat(24,1fr)] gap-[2px]">
              {hours.map((h) => {
                const c = map.get(`${di}-${h}`);
                return (
                  <div
                    key={h}
                    title={c ? `${d} ${h}:00 — ${c.count} видео, эффективность ${Math.round(c.value * 100)}%` : `${d} ${h}:00 — нет публикаций`}
                    className="aspect-square rounded-[4px] transition hover:ring-2 hover:ring-white/60"
                    style={{ background: c ? `rgba(254,44,85,${0.15 + c.value * 0.85})` : "rgba(255,255,255,0.04)" }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="ml-8 mt-2 flex items-center gap-2 text-[10px] text-white/45">
          ниже
          {[0.15, 0.35, 0.55, 0.75, 1].map((a) => (
            <span key={a} className="size-3 rounded-[3px]" style={{ background: `rgba(254,44,85,${a})` }} />
          ))}
          выше просмотры · серые клетки — нет публикаций
        </div>
      </div>
    </div>
  );
}
