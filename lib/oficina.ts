import type { ClockKind, Database, StaffArea, StockStatus, TripSlot } from '@/lib/database.types';

type Tables = Database['public']['Tables'];
export type Staff = Tables['staff']['Row'];
export type ClockEvent = Tables['clock_events']['Row'];
export type Task = Tables['tasks']['Row'];
export type TaskTemplate = Tables['task_templates']['Row'];
export type StockRequest = Tables['stock_requests']['Row'];
export type SaturdayShift = Tables['saturday_shifts']['Row'];

export const STAFF_COLUMNS =
  'id, name, full_name, area, role_label, is_manager, seller_id, start_time, pin_set, active, sort, created_at';

export const TZ = 'America/Argentina/Cordoba';

export const KIOSK_TOKEN_KEY = 'iseven:kiosk-token';

/** Tolerancia de llegada tarde, en minutos. */
export const TOLERANCIA_MIN = 5;
/** Duración de la comida, en minutos. */
export const COMIDA_MIN = 60;
/** Cada cuántas llegadas tarde se descuenta y cuánto. */
export const TARDES_POR_DESCUENTO = 3;
export const DESCUENTO_USD = 20;

export const AREA_LABEL: Record<StaffArea, string> = {
  minorista: 'Ventas minoristas',
  mayorista: 'Ventas mayoristas',
  marketing: 'Marketing',
  tecnico: 'Servicio técnico',
};

export const AREA_COLOR: Record<StaffArea, string> = {
  minorista: '#fe8bea',
  mayorista: '#c9c6e5',
  marketing: '#7fe0cf',
  tecnico: '#eaf3f2',
};

export const KIND_LABEL: Record<ClockKind, string> = {
  entrada: 'Entrada',
  salida_comida: 'Me voy a comer',
  vuelta_comida: 'Vuelvo de comer',
  salida: 'Salida',
};

export const STATUS_LABEL: Record<StockStatus, string> = {
  pendiente: 'Pendiente',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
  entregado: 'En la oficina',
};

export const SLOT_LABEL: Record<TripSlot, string> = {
  '10:00': 'Viaje de las 10:00',
  '15:00': 'Viaje de las 15:00',
  urgente: 'Urgente',
};

/** Marcas que se pueden hacer después de la última. */
export function nextKinds(last: ClockKind | null): ClockKind[] {
  switch (last) {
    case null:
      return ['entrada'];
    case 'entrada':
      return ['salida_comida', 'salida'];
    case 'salida_comida':
      return ['vuelta_comida'];
    case 'vuelta_comida':
      return ['salida'];
    default:
      return [];
  }
}

/** Descuento del mes en USD según la cantidad de llegadas tarde. */
export function descuentoTardes(tardes: number): number {
  return Math.floor(tardes / TARDES_POR_DESCUENTO) * DESCUENTO_USD;
}

/** Hora local HH:MM de un timestamp. */
export function horaAR(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** Fecha local yyyy-mm-dd sumando días a hoy. */
export function dateARPlus(days: number, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(now.getTime() + days * 86400000)
  );
}

/** "lunes 2 de noviembre" a partir de yyyy-mm-dd. */
export function fechaLarga(date: string): string {
  return cap(fechaLargaRaw(date));
}

function fechaLargaRaw(date: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

/** Primera letra en mayúscula ("Miércoles 28 de octubre"). */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function minutosATexto(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Próximos sábados (yyyy-mm-dd), empezando por el de esta semana si todavía no pasó. */
export function proximosSabados(count = 4, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count && i < 60; i++) {
    const d = dateARPlus(i, now);
    if (new Date(`${d}T12:00:00Z`).getUTCDay() === 6) out.push(d);
  }
  return out;
}

/** Primer y último día (yyyy-mm-dd) del mes de una fecha. */
export function monthRange(date: string): { start: string; end: string } {
  const [y, m] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? 'Algo salió mal. Probá de nuevo.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}
