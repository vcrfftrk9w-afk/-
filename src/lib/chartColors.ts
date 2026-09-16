// Validated dark-mode palette (see dataviz skill references/palette.md).
// These hexes are the pre-validated dark-surface steps — reused as-is since
// this app is dark-only (no light theme toggle).
export const CHART = {
  surface: "#1a1a19",
  gridline: "#2c2c2a",
  axis: "#383835",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2c7",
  textMuted: "#898781",
  seriesBlue: "#3987e5",
  seriesOrange: "#d95926",
  seriesAqua: "#199e70",
  seriesYellow: "#c98500",
  seriesMagenta: "#d55181",
  status: {
    good: "#0ca30c",
    warning: "#fab219",
    serious: "#ec835a",
    critical: "#e66767",
  },
  sequentialBlue: [
    "#cde2fb",
    "#9ec5f4",
    "#6da7ec",
    "#3987e5",
    "#256abf",
    "#184f95",
    "#104281",
  ],
};

export function statusColorForValue(value: number): string {
  if (value >= 70) return CHART.status.good;
  if (value >= 40) return CHART.status.warning;
  return CHART.status.critical;
}

export function statusLabelForValue(value: number): string {
  if (value >= 70) return "Сильная сторона";
  if (value >= 40) return "Есть куда расти";
  return "Требует внимания";
}
