import {
  formatNumber,
  formatPct,
  leadsRespondidos,
  pct,
  presupuestosCount,
  seguimientosCount,
  SEMAFORO_LABEL,
  todayAR,
  type Contact,
  type Period,
  type Seller,
  type SellerMetrics,
} from '@/lib/calc';

const SEMAFORO_EMOJI = { verde: '🟢', amarillo: '🟡', rojo: '🔴' } as const;

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const txt = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export interface DailyReportData {
  date: string;
  delDia: Contact[];
  consultas: number;
  respondieron: number;
  presupuestos: number;
  seguimientos: number;
  vendidos: Contact[];
  perdidos: number;
  sinRespuesta: number;
  /** Contactos de días anteriores que se tocaron hoy y hoy figuran como vendidos. */
  cerradosDeAntes: Contact[];
  actualizadosDeAntes: number;
}

export function buildDailyReportData(sellerId: string, contacts: Contact[], date: string = todayAR()): DailyReportData {
  const mine = contacts.filter((c) => c.seller_id === sellerId);
  const delDia = mine.filter((c) => c.date === date);
  const deAntesTocadosHoy = mine.filter((c) => c.date < date && todayAR(new Date(c.updated_at)) === date);

  return {
    date,
    delDia,
    consultas: delDia.length,
    respondieron: leadsRespondidos(sellerId, delDia),
    presupuestos: presupuestosCount(sellerId, delDia),
    seguimientos: seguimientosCount(sellerId, delDia),
    vendidos: delDia.filter((c) => c.estado === 'vendido'),
    perdidos: delDia.filter((c) => c.estado === 'perdido').length,
    sinRespuesta: delDia.filter((c) => c.estado === 'consulta').length,
    cerradosDeAntes: deAntesTocadosHoy.filter((c) => c.estado === 'vendido'),
    actualizadosDeAntes: deAntesTocadosHoy.length,
  };
}

/** Mensaje listo para pegar en WhatsApp (usa *negrita* de WhatsApp). */
export function buildDailyReportText(
  sellerName: string,
  seller: Seller,
  period: Period,
  metrics: SellerMetrics,
  d: DailyReportData
): string {
  const ventasHoy = d.vendidos.length + d.cerradosDeAntes.length;
  const lines: string[] = [];

  lines.push(`📊 *Reporte diario — ${sellerName}*`);
  lines.push(`📅 ${fechaLarga(d.date)}`);
  lines.push('');
  lines.push('*HOY*');
  lines.push(`• Consultas nuevas: ${d.consultas}`);
  lines.push(`• Respondieron: ${d.respondieron} (${formatPct(pct(d.respondieron, d.consultas))})`);
  lines.push(`• Sin respuesta todavía: ${d.sinRespuesta}`);
  lines.push(`• Presupuestos enviados: ${d.presupuestos}`);
  lines.push(`• En seguimiento: ${d.seguimientos}`);
  lines.push(`• Perdidos: ${d.perdidos}`);
  lines.push(`• *Ventas del día: ${ventasHoy}*`);
  if (d.consultas > 0) {
    lines.push(`• Conversión del día: ${formatPct(pct(d.vendidos.length, d.consultas))}`);
  }

  if (ventasHoy > 0) {
    lines.push('');
    lines.push('✅ *Vendidos*');
    d.vendidos.forEach((c) => lines.push(`• ${c.nombre}`));
    d.cerradosDeAntes.forEach((c) => lines.push(`• ${c.nombre} (consulta del ${c.date.slice(8, 10)}/${c.date.slice(5, 7)})`));
  }

  if (d.actualizadosDeAntes > 0) {
    lines.push('');
    lines.push(`🔁 Clientes de días anteriores trabajados hoy: ${d.actualizadosDeAntes}`);
  }

  const { progress } = metrics;
  const reached = metrics.remainingSales <= 0;
  lines.push('');
  lines.push(`*${period.name.toUpperCase()}*`);
  lines.push(
    `• Ventas: ${metrics.currentSales} / ${seller.target} (${formatPct(metrics.cumplimientoPct)})`
  );
  if (!reached) {
    lines.push(`• Faltan: ${metrics.remainingSales} en ${progress.remaining} día${progress.remaining === 1 ? '' : 's'}`);
    lines.push(
      `• Ritmo: ${formatNumber(metrics.paceActual, 1)}/día · necesario ${
        Number.isFinite(metrics.paceNeeded) ? formatNumber(metrics.paceNeeded, 1) : '—'
      }/día ${SEMAFORO_EMOJI[metrics.semaforo]} ${SEMAFORO_LABEL[metrics.semaforo]}`
    );
  }
  lines.push(`• Proyección al cierre: ${Math.round(metrics.proyeccionCierre)}`);
  lines.push(`• Respondieron en el mes: ${metrics.respondidos} · ${formatPct(metrics.convRespondidos)} de cierre`);
  lines.push(
    reached
      ? `🎉 Bono USD ${seller.bonus_usd}: *¡objetivo cumplido!*`
      : `🎯 Bono USD ${seller.bonus_usd}: faltan ${metrics.remainingSales} venta${metrics.remainingSales === 1 ? '' : 's'}`
  );

  return lines.join('\n');
}
