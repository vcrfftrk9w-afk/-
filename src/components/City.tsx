/**
 * Небольшой виртуальный город: завершённые этапы и внешние шаги постепенно его строят.
 * За пропуск он не разрушается, случайных платных наград нет, рейтинга «кто успешнее» нет.
 * Оформление можно полностью отключить в настройках.
 */
export function City({ level }: { level: number }) {
  const buildings = Math.min(12, level);
  const items = Array.from({ length: buildings }, (_, i) => {
    const h = 28 + ((i * 37) % 62);
    return { x: 10 + i * 24, h, w: 18 };
  });

  return (
    <svg className="city" viewBox="0 0 300 120" role="img" aria-label={`Город из ${buildings} построек`}>
      <line x1="0" y1="104" x2="300" y2="104" stroke="var(--line)" strokeWidth="2" />
      {items.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={104 - b.h} width={b.w} height={b.h} rx="3" fill="var(--surface-2)" stroke="var(--line)" />
          <rect x={b.x + 4} y={104 - b.h + 6} width="4" height="4" fill="var(--accent)" opacity="0.8" />
          <rect x={b.x + 10} y={104 - b.h + 14} width="4" height="4" fill="var(--accent)" opacity="0.5" />
        </g>
      ))}
      {buildings === 0 ? (
        <text x="150" y="60" textAnchor="middle" fill="var(--muted)" fontSize="12">
          Пока пусто. Первый этап начнёт стройку
        </text>
      ) : null}
    </svg>
  );
}
