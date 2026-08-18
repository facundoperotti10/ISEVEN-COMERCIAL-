import { SEMAFORO_COLOR, SEMAFORO_LABEL, type Semaforo } from '@/lib/calc';

export function SemaforoBadge({ semaforo }: { semaforo: Semaforo }) {
  const color = SEMAFORO_COLOR[semaforo];
  return (
    <span className="badge" style={{ background: `${color}22`, color }}>
      <span className="badge-dot" style={{ background: color }} />
      {SEMAFORO_LABEL[semaforo]}
    </span>
  );
}
