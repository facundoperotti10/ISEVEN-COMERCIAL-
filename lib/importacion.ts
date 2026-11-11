// Stock en camino: pedidos comprados en Estados Unidos que viajan a Argentina.
// Lógica pura (sin Supabase) para los totales del panel.

export type Ubicacion = 'usa' | 'baires' | 'cordoba' | 'ofi';

export const UBICACIONES: { id: Ubicacion; label: string; corto: string; emoji: string }[] = [
  { id: 'usa', label: 'Estados Unidos', corto: 'USA', emoji: '🇺🇸' },
  { id: 'baires', label: 'Buenos Aires', corto: 'Bs. As.', emoji: '🛬' },
  { id: 'cordoba', label: 'Córdoba', corto: 'Córdoba', emoji: '🚚' },
  { id: 'ofi', label: 'En la oficina', corto: 'Oficina', emoji: '🏢' },
];

export const UBICACION_LABEL: Record<Ubicacion, string> = Object.fromEntries(
  UBICACIONES.map((u) => [u.id, u.label])
) as Record<Ubicacion, string>;

export const CONDICIONES = ['SC', 'Sellado', 'Grado A+', 'Grado A', 'Grado B', 'Usado', 'CPO'] as const;

export type PedidoEntrante = {
  id: string;
  numero: number;
  fecha: string; // yyyy-mm-dd
  proveedor: string | null;
  ubicacion: Ubicacion;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  modelo: string;
  condicion: string;
  color: string | null;
  cantidad: number;
  costo: number; // USD por unidad
  reservado: number; // vendidos en preventa
};

export interface Totales {
  pedidos: number;
  unidades: number;
  reservadas: number;
  disponibles: number;
  /** Plata invertida: cantidad × costo, en USD. */
  usd: number;
}

const VACIO: Totales = { pedidos: 0, unidades: 0, reservadas: 0, disponibles: 0, usd: 0 };

/** El costo llega de Postgres como numeric: a veces viene como texto. */
export function costoNum(c: number | string): number {
  const n = typeof c === 'number' ? c : Number.parseFloat(c);
  return Number.isFinite(n) ? n : 0;
}

export function totalesItems(items: PedidoItem[]): Omit<Totales, 'pedidos'> {
  let unidades = 0;
  let reservadas = 0;
  let usd = 0;
  for (const it of items) {
    unidades += it.cantidad;
    reservadas += it.reservado;
    usd += it.cantidad * costoNum(it.costo);
  }
  return { unidades, reservadas, disponibles: unidades - reservadas, usd };
}

/** Totales por ubicación (USA, Bs. As., Córdoba, Oficina) y el total "en camino" (todo menos Oficina). */
export function totalesPorUbicacion(pedidos: PedidoEntrante[], items: PedidoItem[]) {
  const porPedido = new Map<string, PedidoItem[]>();
  for (const it of items) {
    const list = porPedido.get(it.pedido_id) ?? [];
    list.push(it);
    porPedido.set(it.pedido_id, list);
  }
  const por: Record<Ubicacion, Totales> = {
    usa: { ...VACIO },
    baires: { ...VACIO },
    cordoba: { ...VACIO },
    ofi: { ...VACIO },
  };
  for (const p of pedidos) {
    const t = totalesItems(porPedido.get(p.id) ?? []);
    const acc = por[p.ubicacion];
    acc.pedidos += 1;
    acc.unidades += t.unidades;
    acc.reservadas += t.reservadas;
    acc.disponibles += t.disponibles;
    acc.usd += t.usd;
  }
  const enCamino: Totales = { ...VACIO };
  for (const u of ['usa', 'baires', 'cordoba'] as const) {
    for (const k of Object.keys(enCamino) as (keyof Totales)[]) enCamino[k] += por[u][k];
  }
  return { por, enCamino };
}

export interface ResumenModelo {
  modelo: string;
  condicion: string;
  unidades: number;
  reservadas: number;
  disponibles: number;
  usd: number;
  costoPromedio: number;
}

/** Stock agrupado por modelo + condición (los colores se suman), de mayor a menor cantidad. */
export function resumenPorModelo(items: PedidoItem[]): ResumenModelo[] {
  const map = new Map<string, ResumenModelo>();
  for (const it of items) {
    const key = `${it.modelo.trim().toLowerCase()}|${it.condicion}`;
    const row =
      map.get(key) ??
      { modelo: it.modelo.trim(), condicion: it.condicion, unidades: 0, reservadas: 0, disponibles: 0, usd: 0, costoPromedio: 0 };
    row.unidades += it.cantidad;
    row.reservadas += it.reservado;
    row.disponibles += it.cantidad - it.reservado;
    row.usd += it.cantidad * costoNum(it.costo);
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, costoPromedio: r.unidades ? r.usd / r.unidades : 0 }))
    .sort((a, b) => b.unidades - a.unidades || a.modelo.localeCompare(b.modelo, 'es'));
}

export function siguienteNumero(pedidos: PedidoEntrante[]): number {
  return pedidos.reduce((max, p) => Math.max(max, p.numero), 0) + 1;
}

export function formatUSD(n: number): string {
  return `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)}`;
}
