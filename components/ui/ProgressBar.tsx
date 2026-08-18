interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  trackClassName?: string;
  height?: number;
}

export function ProgressBar({ value, color = '#2C8598', trackClassName, height = 10 }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={`w-full rounded-full bg-bg-elevated overflow-hidden ${trackClassName ?? ''}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
