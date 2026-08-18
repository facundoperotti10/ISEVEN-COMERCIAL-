import { formatPct } from '@/lib/calc';

interface RespondidosCardProps {
  respondidos: number;
  convRespondidos: number;
}

export function RespondidosCard({ respondidos, convRespondidos }: RespondidosCardProps) {
  const lowClose = respondidos > 0 && convRespondidos < 20;

  return (
    <div className="card p-4">
      <div className="text-xs text-text-secondary">Leads que te respondieron</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="stat-number text-3xl">{respondidos}</span>
        <span className="text-sm text-text-muted">· {formatPct(convRespondidos)} de cierre</span>
      </div>
      {lowClose && (
        <p className="mt-2 text-xs text-yellow">
          Te responden pero cerrás poco sobre esos leads — revisá el seguimiento y la propuesta.
        </p>
      )}
    </div>
  );
}
