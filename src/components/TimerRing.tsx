import { formatClock } from '../lib/date';

/**
 * Время видно наглядно, а не только цифрами: кольцо убывает вместе с остатком.
 */
export function TimerRing({
  totalSeconds,
  leftSeconds,
  visual = true,
  label,
}: {
  totalSeconds: number;
  leftSeconds: number;
  visual?: boolean;
  label?: string;
}) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, leftSeconds / totalSeconds)) : 0;

  return (
    <div className="timer-wrap">
      {visual ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      ) : null}
      <div className="timer-digits" aria-live="polite">
        {formatClock(leftSeconds)}
      </div>
      {label ? <div className="muted small">{label}</div> : null}
    </div>
  );
}
