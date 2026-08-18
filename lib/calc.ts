import type { ContactEstado } from '@/lib/database.types';

export type Seller = {
  id: string;
  name: string;
  target: number;
  initial_sales: number;
  bonus_usd: number;
  active: boolean;
};

export type Contact = {
  id: string;
  seller_id: string;
  date: string; // yyyy-mm-dd
  nombre: string;
  telefono: string | null;
  estado: ContactEstado;
  observacion: string | null;
  created_at: string;
  updated_at: string;
};

export type Period = {
  name: string;
  start_date: string;
  end_date: string;
};

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

export const ESTADOS: { value: ContactEstado; label: string }[] = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'respondio', label: 'Respondió' },
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'perdido', label: 'Perdido' },
];

export const ESTADO_LABEL: Record<ContactEstado, string> = Object.fromEntries(
  ESTADOS.map((e) => [e.value, e.label])
) as Record<ContactEstado, string>;

// ---------------------------------------------------------------------------
// Fechas / período
// ---------------------------------------------------------------------------

function toStartOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00`) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface PeriodProgress {
  totalDays: number;
  elapsed: number;
  remaining: number;
}

/** Días totales, transcurridos y restantes del período, en base a hoy. */
export function getPeriodProgress(period: Period, today: Date = new Date()): PeriodProgress {
  const start = toStartOfDay(period.start_date);
  const end = toStartOfDay(period.end_date);
  const now = toStartOfDay(today);

  const totalDays = Math.max(daysBetween(start, end) + 1, 1);
  const elapsedRaw = daysBetween(start, now) + 1;
  const elapsed = Math.min(Math.max(elapsedRaw, 1), totalDays);
  const remaining = Math.max(totalDays - elapsed, 0);

  return { totalDays, elapsed, remaining };
}

// ---------------------------------------------------------------------------
// Ventas / ritmo
// ---------------------------------------------------------------------------

export function contactsForSeller(sellerId: string, contacts: Contact[]): Contact[] {
  return contacts.filter((c) => c.seller_id === sellerId);
}

/** Cantidad de ventas nuevas (estado = vendido) del período para un vendedor. */
export function ventasNuevas(sellerId: string, contacts: Contact[]): number {
  return contacts.filter((c) => c.seller_id === sellerId && c.estado === 'vendido').length;
}

export function currentSales(seller: Seller, contacts: Contact[]): number {
  return seller.initial_sales + ventasNuevas(seller.id, contacts);
}

export function remainingSales(seller: Seller, contacts: Contact[]): number {
  return Math.max(seller.target - currentSales(seller, contacts), 0);
}

export function paceActual(nuevas: number, elapsedDays: number): number {
  return elapsedDays > 0 ? nuevas / elapsedDays : 0;
}

export function paceNeeded(remaining: number, remainingDays: number): number {
  if (remaining <= 0) return 0;
  if (remainingDays <= 0) return Infinity;
  return remaining / remainingDays;
}

export function getSemaforo(pActual: number, pNeeded: number): Semaforo {
  if (pNeeded <= 0) return 'verde';
  if (pActual >= pNeeded) return 'verde';
  if (pActual >= pNeeded * 0.75) return 'amarillo';
  return 'rojo';
}

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: '#4ADE80',
  amarillo: '#FBBF24',
  rojo: '#F87171',
};

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: 'En ritmo',
  amarillo: 'Ajustado',
  rojo: 'Atrasado',
};

// ---------------------------------------------------------------------------
// Embudo
// ---------------------------------------------------------------------------

export function leadsRespondidos(sellerId: string, contacts: Contact[]): number {
  return contacts.filter((c) => c.seller_id === sellerId && c.estado !== 'consulta').length;
}

export function presupuestosCount(sellerId: string, contacts: Contact[]): number {
  return contacts.filter(
    (c) =>
      c.seller_id === sellerId &&
      (c.estado === 'presupuesto' || c.estado === 'seguimiento' || c.estado === 'vendido')
  ).length;
}

export function seguimientosCount(sellerId: string, contacts: Contact[]): number {
  return contacts.filter(
    (c) => c.seller_id === sellerId && (c.estado === 'seguimiento' || c.estado === 'vendido')
  ).length;
}

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

// ---------------------------------------------------------------------------
// Métricas completas por vendedor
// ---------------------------------------------------------------------------

export interface SellerMetrics {
  seller: Seller;
  progress: PeriodProgress;
  consultas: number; // total de contactos cargados (todas las etapas)
  respondidos: number;
  presupuestos: number;
  seguimientos: number;
  ventasNuevas: number;
  currentSales: number;
  remainingSales: number;
  convGeneral: number; // ventas / consultas * 100
  convRespondidos: number; // ventas / respondidos * 100
  paceActual: number;
  paceNeeded: number;
  semaforo: Semaforo;
  cumplimientoPct: number; // currentSales / target * 100
  proyeccionCierre: number; // currentSales + paceActual * remainingDays
}

export function buildSellerMetrics(
  seller: Seller,
  allContacts: Contact[],
  period: Period,
  today: Date = new Date()
): SellerMetrics {
  const contacts = contactsForSeller(seller.id, allContacts);
  const progress = getPeriodProgress(period, today);

  const consultas = contacts.length;
  const respondidos = leadsRespondidos(seller.id, allContacts);
  const presupuestos = presupuestosCount(seller.id, allContacts);
  const seguimientos = seguimientosCount(seller.id, allContacts);
  const nuevas = ventasNuevas(seller.id, allContacts);
  const sales = currentSales(seller, allContacts);
  const remaining = remainingSales(seller, allContacts);

  const pActual = paceActual(nuevas, progress.elapsed);
  const pNeeded = paceNeeded(remaining, progress.remaining);

  return {
    seller,
    progress,
    consultas,
    respondidos,
    presupuestos,
    seguimientos,
    ventasNuevas: nuevas,
    currentSales: sales,
    remainingSales: remaining,
    convGeneral: pct(nuevas, consultas),
    convRespondidos: pct(nuevas, respondidos),
    paceActual: pActual,
    paceNeeded: pNeeded,
    semaforo: getSemaforo(pActual, pNeeded),
    cumplimientoPct: seller.target > 0 ? pct(sales, seller.target) : 0,
    proyeccionCierre: sales + pActual * progress.remaining,
  };
}

// ---------------------------------------------------------------------------
// Promedios de equipo y diagnóstico automático
// ---------------------------------------------------------------------------

export interface TeamAverages {
  avgConsultas: number;
  avgConvGeneral: number;
  avgConvRespondidos: number;
}

export function buildTeamAverages(metrics: SellerMetrics[]): TeamAverages {
  const active = metrics.filter((m) => m.seller.active);
  const n = active.length || 1;
  return {
    avgConsultas: active.reduce((s, m) => s + m.consultas, 0) / n,
    avgConvGeneral: active.reduce((s, m) => s + m.convGeneral, 0) / n,
    avgConvRespondidos: active.reduce((s, m) => s + m.convRespondidos, 0) / n,
  };
}

export type Diagnostico =
  | 'volumen'
  | 'cierre'
  | 'conversion'
  | 'seguimiento'
  | 'ritmo'
  | 'saludable';

export const DIAGNOSTICO_LABEL: Record<Diagnostico, string> = {
  volumen: 'Problema de volumen de oportunidades',
  cierre: 'Le responden pero cierra pocas — problema de cierre',
  conversion: 'Problema de conversión',
  seguimiento: 'Bajo nivel de seguimiento',
  ritmo: 'Por debajo del ritmo necesario',
  saludable: 'Rendimiento saludable',
};

export function diagnosticar(m: SellerMetrics, team: TeamAverages): Diagnostico {
  if (m.consultas < team.avgConsultas * 0.7 && m.convGeneral >= team.avgConvGeneral * 0.8) {
    return 'volumen';
  }
  if (m.respondidos > 0 && m.convRespondidos < team.avgConvRespondidos * 0.7) {
    return 'cierre';
  }
  if (m.convGeneral < team.avgConvGeneral * 0.7) {
    return 'conversion';
  }
  if (m.presupuestos > 0 && pct(m.seguimientos, m.presupuestos) < 50) {
    return 'seguimiento';
  }
  if (m.semaforo !== 'verde') {
    return 'ritmo';
  }
  return 'saludable';
}

// ---------------------------------------------------------------------------
// Proyección de equipo
// ---------------------------------------------------------------------------

export interface TeamProjection {
  currentSales: number;
  target: number;
  paceActual: number;
  paceNeeded: number;
  projectedClose: number;
  remainingDays: number;
}

export function buildTeamProjection(metrics: SellerMetrics[], period: Period, today: Date = new Date()): TeamProjection {
  const active = metrics.filter((m) => m.seller.active);
  const progress = getPeriodProgress(period, today);
  const sales = active.reduce((s, m) => s + m.currentSales, 0);
  const target = active.reduce((s, m) => s + m.seller.target, 0);
  const remaining = Math.max(target - sales, 0);
  const nuevas = active.reduce((s, m) => s + m.ventasNuevas, 0);
  const pActual = paceActual(nuevas, progress.elapsed);
  const pNeeded = paceNeeded(remaining, progress.remaining);

  return {
    currentSales: sales,
    target,
    paceActual: pActual,
    paceNeeded: pNeeded,
    projectedClose: sales + pActual * progress.remaining,
    remainingDays: progress.remaining,
  };
}

// ---------------------------------------------------------------------------
// Comparación semanal
// ---------------------------------------------------------------------------

export interface WeekMetrics {
  ventas: number;
  consultas: number;
  respondidos: number;
  presupuestos: number;
  seguimientos: number;
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const d = toStartOfDay(dateStr);
  return d >= start && d <= end;
}

/** Lunes 00:00 de la semana que contiene `date`. */
function startOfWeek(date: Date): Date {
  const d = toStartOfDay(date);
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekRanges(today: Date = new Date()) {
  const currentStart = startOfWeek(today);
  const currentEnd = toStartOfDay(today);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 6);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

export function weekMetricsFor(sellerId: string, contacts: Contact[], start: Date, end: Date): WeekMetrics {
  const inWeek = contacts.filter((c) => c.seller_id === sellerId && inRange(c.date, start, end));
  return {
    ventas: inWeek.filter((c) => c.estado === 'vendido').length,
    consultas: inWeek.length,
    respondidos: inWeek.filter((c) => c.estado !== 'consulta').length,
    presupuestos: inWeek.filter((c) =>
      ['presupuesto', 'seguimiento', 'vendido'].includes(c.estado)
    ).length,
    seguimientos: inWeek.filter((c) => ['seguimiento', 'vendido'].includes(c.estado)).length,
  };
}

export function variacionPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "sin base de comparación"
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Ventas por día (para gráficos)
// ---------------------------------------------------------------------------

export interface DailySales {
  date: string;
  ventas: number;
}

export function salesByDay(sellerId: string | null, contacts: Contact[], period: Period): DailySales[] {
  const filtered = sellerId ? contactsForSeller(sellerId, contacts) : contacts;
  const sold = filtered.filter((c) => c.estado === 'vendido');

  const start = toStartOfDay(period.start_date);
  const end = toStartOfDay(period.end_date);
  const days: DailySales[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, ventas: sold.filter((c) => c.date === key).length });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

export function formatPct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function contactsToCSV(contacts: Contact[], sellersById: Record<string, Seller>): string {
  const header = ['vendedor', 'fecha', 'nombre_cliente', 'telefono', 'estado', 'observacion'];
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;

  const rows = contacts.map((c) =>
    [
      sellersById[c.seller_id]?.name ?? c.seller_id,
      c.date,
      c.nombre,
      c.telefono ?? '',
      ESTADO_LABEL[c.estado],
      c.observacion ?? '',
    ]
      .map(escape)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
}
