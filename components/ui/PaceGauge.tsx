import { SEMAFORO_COLOR, type Semaforo } from '@/lib/calc';

interface PaceGaugeProps {
  paceActual: number;
  paceNeeded: number;
  semaforo: Semaforo;
  label?: string;
}

/**
 * Barra horizontal que compara el ritmo actual de ventas con el ritmo
 * necesario para llegar al objetivo. La marca vertical indica el ritmo
 * necesario; el relleno de color (semáforo) indica el ritmo actual.
 */
export function PaceGauge({ paceActual, paceNeeded, semaforo, label }: PaceGaugeProps) {
  const scaleMax = Math.max(paceActual, paceNeeded, 0.1) * 1.25;
  const actualPct = Math.min((paceActual / scaleMax) * 100, 100);
  const neededPct = Number.isFinite(paceNeeded) ? Math.min((paceNeeded / scaleMax) * 100, 100) : 100;
  const color = SEMAFORO_COLOR[semaforo];

  return (
    <div className="w-full">
      {label && <div className="mb-1.5 text-xs text-text-secondary">{label}</div>}
      <div className="relative h-3 w-full rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${actualPct}%`, background: color }}
        />
        <div
          className="absolute top-[-3px] h-[18px] w-[3px] rounded-full bg-text"
          style={{ left: `calc(${neededPct}% - 1.5px)` }}
          title="Ritmo necesario"
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
        <span>Ritmo actual: {paceActual.toFixed(2)}/día</span>
        <span>Necesario: {Number.isFinite(paceNeeded) ? paceNeeded.toFixed(2) : '—'}/día</span>
      </div>
    </div>
  );
}
