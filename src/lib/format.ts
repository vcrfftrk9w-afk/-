// Parses numbers the way TikTok displays them so users can paste stats
// straight from the app without manual conversion: "12.3K" -> 12300,
// "1.2M" -> 1200000, "1,234" -> 1234, "45 тыс" -> 45000.
export function parseCount(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === "number") return Math.round(input);

  const s = input.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  if (!s) return 0;

  const match = s.match(/^(-?[\d.]+)(k|к|тыс|m|м|млн)?$/i);
  if (!match) {
    const digitsOnly = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(digitsOnly) ? Math.round(digitsOnly) : 0;
  }

  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (!Number.isFinite(num)) return 0;
  if (!suffix) return Math.round(num);
  if (suffix === "k" || suffix === "к" || suffix === "тыс") return Math.round(num * 1000);
  if (suffix === "m" || suffix === "м" || suffix === "млн") return Math.round(num * 1_000_000);
  return Math.round(num);
}

export function formatCompactNumber(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return Math.round(v).toString();
}
