import type { StockRequest } from '@/lib/oficina';
import { STATUS_LABEL, fechaLarga } from '@/lib/oficina';

const STATUS_CLASS = {
  pendiente: 'bg-yellow/15 text-yellow',
  autorizado: 'bg-green/15 text-green',
  rechazado: 'bg-red/15 text-red',
  entregado: 'bg-lilac/15 text-lilac',
} as const;

export function StockRequestCard({
  r,
  who,
  children,
}: {
  r: StockRequest;
  who?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] bg-bg-elevated px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text">
          {r.modelo}
          {r.capacidad ? ` ${r.capacidad}` : ''}
          {r.color ? ` · ${r.color}` : ''}
        </span>
        <span className="flex gap-1.5">
          {r.urgent && <span className="badge bg-red/15 text-red">Urgente</span>}
          <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {who ? `${who} · ` : ''}
        {r.cliente} · {fechaLarga(r.turno_date)}
        {r.turno_time ? ` ${r.turno_time.slice(0, 5)}` : ''} · {r.tipo === 'venta' ? 'Venta segura' : 'Para mostrar'}
      </p>
      {r.imei && (
        <p className="mt-1 text-xs text-text-secondary">
          IMEI terminado en <span className="select-all font-mono font-semibold tracking-wider text-text">{r.imei}</span>
        </p>
      )}
      {r.note && <p className="mt-1 text-xs text-text-muted">{r.note}</p>}
      {children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
