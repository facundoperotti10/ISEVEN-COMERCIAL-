'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ClockKind, StaffArea } from '@/lib/database.types';
import { AREA_COLOR, COMIDA_MIN, horaAR } from '@/lib/oficina';

/** Estado del día de cada integrante (función office_live de la base). */
interface LivePerson {
  id: string;
  name: string;
  area: StaffArea;
  role_label: string;
  is_manager: boolean;
  last_kind: ClockKind | null;
  last_at: string | null;
  entrada_at: string | null;
  lunch_at: string | null;
  late_today: boolean;
  tasks_total: number;
  tasks_done: number;
  current_task: string | null;
  stock_pending: number;
}

interface LiveData {
  now: string;
  stock_pending: number;
  people: LivePerson[];
}

type Place = 'oficina' | 'comedor' | 'afuera';

function placeOf(p: LivePerson): Place {
  if (!p.last_kind || p.last_kind === 'salida') return 'afuera';
  if (p.last_kind === 'salida_comida') return 'comedor';
  return 'oficina';
}

// ---------------------------------------------------------------------------
// Plano de la oficina (coordenadas lógicas; el canvas se escala al ancho)
// ---------------------------------------------------------------------------
const W = 960;
const H = 400;
const ZONES = [
  { id: 'minorista', name: 'Ventas local', x: 10, y: 10, w: 620, h: 185, color: AREA_COLOR.minorista },
  { id: 'mayorista', name: 'Mayorista', x: 640, y: 10, w: 310, h: 185, color: AREA_COLOR.mayorista },
  { id: 'marketing', name: 'Marketing', x: 10, y: 205, w: 305, h: 185, color: AREA_COLOR.marketing },
  { id: 'tecnico', name: 'Servicio técnico', x: 325, y: 205, w: 305, h: 185, color: AREA_COLOR.tecnico },
  { id: 'comedor', name: 'Comedor', x: 640, y: 205, w: 310, h: 185, color: '#fbbf24' },
] as const;

type Furniture = { x: number; y: number; kind: 'desk' | 'counter' | 'bench' | 'vitrina' | 'tripod' | 'table' | 'boxes' };
const FURNITURE: Furniture[] = [
  { x: 110, y: 85, kind: 'desk' },
  { x: 250, y: 85, kind: 'desk' },
  { x: 390, y: 85, kind: 'desk' },
  { x: 530, y: 85, kind: 'desk' },
  { x: 320, y: 150, kind: 'counter' },
  { x: 730, y: 85, kind: 'desk' },
  { x: 870, y: 85, kind: 'desk' },
  { x: 795, y: 155, kind: 'boxes' },
  { x: 110, y: 280, kind: 'vitrina' },
  { x: 245, y: 330, kind: 'tripod' },
  { x: 420, y: 280, kind: 'bench' },
  { x: 560, y: 280, kind: 'bench' },
  { x: 795, y: 315, kind: 'table' },
];

/** Puesto fijo de cada uno y un lugar al que va cada tanto (mostrador, vitrina, etc.). */
const STATIONS: Record<string, { home: [number, number]; spot: [number, number] }> = {
  agus: { home: [110, 130], spot: [250, 178] },
  mateo: { home: [250, 130], spot: [330, 178] },
  fran: { home: [390, 130], spot: [410, 178] },
  emi: { home: [730, 125], spot: [795, 185] },
  sofi: { home: [110, 320], spot: [215, 360] },
  santi: { home: [420, 320], spot: [560, 320] },
};
const EXTRA_HOMES: Record<StaffArea, [number, number][]> = {
  minorista: [[530, 125]],
  mayorista: [[870, 125]],
  marketing: [[160, 360]],
  tecnico: [[480, 360]],
};
const LUNCH_SEATS: [number, number][] = [
  [700, 285],
  [890, 285],
  [700, 350],
  [890, 350],
  [795, 255],
  [795, 365],
];

interface Sprite {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: number;
  nextMove: number;
  atSpot: boolean;
  visible: boolean;
  alpha: number;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function phone(ctx: CanvasRenderingContext2D, x: number, y: number, c = '#1c1c22') {
  ctx.fillStyle = c;
  rr(ctx, x, y, 6, 10, 1.5);
  ctx.fill();
  ctx.fillStyle = '#7fe0cf';
  ctx.fillRect(x + 1, y + 1.5, 4, 6);
}

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture) {
  const { x, y } = f;
  switch (f.kind) {
    case 'desk':
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      rr(ctx, x - 30, y - 8, 60, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#bdb8e0';
      rr(ctx, x - 30, y - 12, 60, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#24262e';
      rr(ctx, x - 12, y - 24, 24, 16, 2);
      ctx.fill();
      ctx.fillStyle = '#2f8a9a';
      ctx.fillRect(x - 10, y - 22, 20, 11);
      phone(ctx, x + 16, y - 6);
      break;
    case 'counter':
      ctx.fillStyle = '#c9c6e5';
      rr(ctx, x - 80, y - 10, 160, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#ff8123';
      ctx.fillRect(x - 80, y + 6, 160, 4);
      phone(ctx, x - 50, y - 6);
      phone(ctx, x - 20, y - 6, '#eaf3f2');
      phone(ctx, x + 30, y - 6);
      break;
    case 'boxes':
      [
        [-22, -4],
        [0, -4],
        [-11, -18],
      ].forEach(([dx, dy]) => {
        ctx.fillStyle = '#c79a62';
        rr(ctx, x + dx - 1, y + dy - 8, 20, 14, 2);
        ctx.fill();
      });
      break;
    case 'vitrina':
      ctx.fillStyle = 'rgba(201,198,229,.25)';
      rr(ctx, x - 44, y - 20, 88, 30, 5);
      ctx.fill();
      ctx.strokeStyle = '#c9c6e5';
      ctx.lineWidth = 1.5;
      rr(ctx, x - 44, y - 20, 88, 30, 5);
      ctx.stroke();
      for (let i = 0; i < 6; i++) phone(ctx, x - 36 + i * 13, y - 12, ['#24262e', '#eaf3f2', '#fe8bea'][i % 3]);
      break;
    case 'tripod':
      ctx.strokeStyle = '#eaf3f2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 22, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#8fb3bb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x, y + 6);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 10);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 10);
      ctx.stroke();
      break;
    case 'bench':
      ctx.fillStyle = '#bdb8e0';
      rr(ctx, x - 36, y - 12, 72, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#24262e';
      rr(ctx, x - 26, y - 8, 10, 16, 2);
      ctx.fill();
      rr(ctx, x - 10, y - 8, 10, 16, 2);
      ctx.fill();
      ctx.strokeStyle = '#ff8123';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 6);
      ctx.lineTo(x + 26, y - 6);
      ctx.stroke();
      break;
    case 'table':
      ctx.fillStyle = '#8b5a2b';
      rr(ctx, x - 60, y - 14, 120, 30, 10);
      ctx.fill();
      ctx.fillStyle = '#eaf3f2';
      ctx.beginPath();
      ctx.arc(x - 25, y, 6, 0, Math.PI * 2);
      ctx.arc(x + 25, y, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

export function OficinaEnVivo() {
  const supabase = useMemo(() => createClient(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<LiveData | null>(null);
  const spritesRef = useRef<Record<string, Sprite>>({});
  const selectedRef = useRef<string | null>(null);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('office_live');
    if (e) {
      setError('No se pudo cargar la oficina en vivo.');
      return;
    }
    setError(null);
    dataRef.current = d as LiveData;
    setData(d as LiveData);
    setNowMs(Date.now());
  }, [supabase]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Animación: dibuja la oficina en cada frame con los datos más recientes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let scale = 1;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // En el celular la oficina mantiene un tamaño legible y se desliza de costado.
      const w = Math.max(wrap.clientWidth, 680);
      scale = w / W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * scale * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H * scale}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const targetFor = (p: LivePerson, idx: number, lunchIdx: number, sp: Sprite | undefined, t: number): [number, number] | null => {
      const place = placeOf(p);
      if (place === 'afuera') return null;
      if (place === 'comedor') return LUNCH_SEATS[lunchIdx % LUNCH_SEATS.length];
      const st = STATIONS[p.id];
      const home = st?.home ?? EXTRA_HOMES[p.area][idx % EXTRA_HOMES[p.area].length];
      if (!sp || reduce) return home;
      // Cada tanto se levanta y va a su otro lugar de trabajo (mostrador, vitrina, banco).
      if (t > sp.nextMove) {
        sp.atSpot = !sp.atSpot && Boolean(st);
        sp.nextMove = t + (sp.atSpot ? 6000 : 12000) + Math.random() * 8000;
      }
      return sp.atSpot && st ? st.spot : home;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const d = dataRef.current;
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.fillStyle = '#0c2429';
      ctx.fillRect(0, 0, W, H);

      ZONES.forEach((z) => {
        ctx.fillStyle = '#123339';
        rr(ctx, z.x, z.y, z.w, z.h, 10);
        ctx.fill();
        ctx.save();
        rr(ctx, z.x, z.y, z.w, z.h, 10);
        ctx.clip();
        ctx.strokeStyle = 'rgba(201,198,229,.05)';
        ctx.lineWidth = 1;
        for (let x = z.x; x < z.x + z.w; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, z.y);
          ctx.lineTo(x + 0.5, z.y + z.h);
          ctx.stroke();
        }
        for (let y = z.y; y < z.y + z.h; y += 20) {
          ctx.beginPath();
          ctx.moveTo(z.x, y + 0.5);
          ctx.lineTo(z.x + z.w, y + 0.5);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = z.color;
        rr(ctx, z.x + 10, z.y + 10, 8, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#eaf3f2';
        ctx.font = '600 12px Poppins, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(z.name.toUpperCase(), z.x + 24, z.y + 14.5);
      });
      FURNITURE.forEach((f) => drawFurniture(ctx, f));

      if (!d) {
        raf = requestAnimationFrame(frame);
        return;
      }

      // Posiciones objetivo
      const byArea: Record<string, number> = {};
      let lunchIdx = 0;
      const drawn: { p: LivePerson; s: Sprite }[] = [];
      d.people.forEach((p) => {
        const idx = STATIONS[p.id] ? 0 : (byArea[p.area] = (byArea[p.area] ?? -1) + 1);
        let s = spritesRef.current[p.id];
        const place = placeOf(p);
        const target = targetFor(p, idx, place === 'comedor' ? lunchIdx++ : 0, s, now);
        if (!s) {
          const start = target ?? [W - 30, H - 20];
          s = spritesRef.current[p.id] = {
            x: start[0],
            y: start[1],
            tx: start[0],
            ty: start[1],
            phase: Math.random() * 6,
            nextMove: now + 4000 + Math.random() * 10000,
            atSpot: false,
            visible: Boolean(target),
            alpha: target ? 1 : 0,
          };
        }
        if (target) {
          s.tx = target[0];
          s.ty = target[1];
          s.visible = true;
        } else {
          s.visible = false;
        }
        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        const dist = Math.hypot(dx, dy);
        const v = 70 * dt;
        const walking = dist > 1 && !reduce;
        if (reduce || dist <= v) {
          s.x = s.tx;
          s.y = s.ty;
        } else {
          s.x += (dx / dist) * v;
          s.y += (dy / dist) * v;
        }
        s.alpha = Math.max(0, Math.min(1, s.alpha + (s.visible ? dt * 2 : -dt * 2)));
        (s as Sprite & { walking?: boolean }).walking = walking;
        if (s.alpha > 0) drawn.push({ p, s });
      });

      drawn
        .sort((a, b) => a.s.y - b.s.y)
        .forEach(({ p, s }) => {
          const t = now / 1000 + s.phase;
          const walking = (s as Sprite & { walking?: boolean }).walking;
          const sel = selectedRef.current === p.id;
          const place = placeOf(p);
          ctx.globalAlpha = s.alpha;
          const bob = walking ? Math.sin(t * 14) * 1.6 : 0;
          const K = 1.45;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.scale(K, K);
          const x = 0;
          const y = 0;
          // sombra y selección
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          ctx.beginPath();
          ctx.ellipse(x, y + 12, 10, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (sel) {
            ctx.strokeStyle = '#ff8123';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(x, y + 12, 15, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          // cuerpo
          const leg = walking ? Math.sin(t * 14) * 3 : 0;
          ctx.fillStyle = '#22313a';
          ctx.fillRect(x - 5, y + 3 + bob, 4, 9 + leg * 0.3);
          ctx.fillRect(x + 1, y + 3 + bob, 4, 9 - leg * 0.3);
          ctx.fillStyle = AREA_COLOR[p.area];
          rr(ctx, x - 8, y - 10 + bob, 16, 16, 5);
          ctx.fill();
          ctx.fillStyle = '#e3b48c';
          ctx.beginPath();
          ctx.arc(x, y - 17 + bob, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2b1d14';
          ctx.beginPath();
          ctx.arc(x, y - 19 + bob, 7.6, Math.PI * 1.05, Math.PI * 1.95);
          ctx.fill();
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(x - 3, y - 17 + bob, 1.6, 1.8);
          ctx.fillRect(x + 1.5, y - 17 + bob, 1.6, 1.8);

          // comiendo: mate
          if (place === 'comedor' && !walking) {
            const sip = (Math.sin(t * 1.6) + 1) / 2 > 0.82;
            const mx = x + (sip ? 5 : 11);
            const my = y + (sip ? -12 : -2);
            ctx.fillStyle = '#8b5a2b';
            ctx.beginPath();
            ctx.ellipse(mx, my, 4.5, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d9d9e3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mx + 1, my - 4);
            ctx.lineTo(mx + 4, my - 11);
            ctx.stroke();
          }

          // nombre + avance de tareas
          ctx.font = '600 11px Poppins, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          const label = p.name;
          const lw = ctx.measureText(label).width + 12;
          ctx.fillStyle = sel ? '#ff8123' : 'rgba(12,36,41,.9)';
          rr(ctx, x - lw / 2, y + 16, lw, 15, 7);
          ctx.fill();
          ctx.fillStyle = sel ? '#2a1300' : '#eaf3f2';
          ctx.fillText(label, x, y + 27);
          let lunchLeft: number | null = null;
          if (place === 'comedor' && p.lunch_at) {
            lunchLeft = Math.ceil(COMIDA_MIN - (Date.now() - new Date(p.lunch_at).getTime()) / 60000);
            const txt = lunchLeft >= 0 ? `quedan ${lunchLeft}'` : `+${-lunchLeft}' tarde`;
            ctx.font = '700 10px Poppins, system-ui, sans-serif';
            const tw = ctx.measureText(txt).width + 10;
            ctx.fillStyle = lunchLeft >= 0 ? (lunchLeft <= 10 ? '#fbbf24' : '#4ade80') : '#f87171';
            rr(ctx, x - tw / 2, y + 34, tw, 13, 6);
            ctx.fill();
            ctx.fillStyle = '#0c2429';
            ctx.textAlign = 'center';
            ctx.fillText(txt, x, y + 44);
          } else if (p.tasks_total > 0) {
            const pw = 34;
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.fillRect(x - pw / 2, y + 34, pw, 3);
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(x - pw / 2, y + 34, (pw * p.tasks_done) / p.tasks_total, 3);
          }
          if (p.late_today) {
            ctx.fillStyle = '#f87171';
            ctx.beginPath();
            ctx.arc(x + 10, y - 24 + bob, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // sobre: pedido de stock esperando autorización
          if (p.stock_pending > 0) {
            const ey = y - 34 + Math.sin(t * 3) * 2;
            ctx.fillStyle = '#eaf3f2';
            rr(ctx, x + 14, ey, 18, 12, 2);
            ctx.fill();
            ctx.strokeStyle = '#fe8bea';
            ctx.lineWidth = 2;
            rr(ctx, x + 14, ey, 18, 12, 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 14, ey);
            ctx.lineTo(x + 23, ey + 7);
            ctx.lineTo(x + 32, ey);
            ctx.stroke();
          }
          ctx.restore();

          // globo: qué está haciendo
          let bubble: string | null = null;
          const tone = '#eaf3f2';
          if (place === 'comedor') {
            bubble = null;
          } else if (!walking) {
            bubble = p.current_task ?? (p.tasks_total > 0 ? 'Todo hecho por hoy ✓' : null);
          }
          if (bubble) {
            ctx.font = '500 13px Poppins, system-ui, sans-serif';
            const max = sel ? 260 : 120;
            let text = bubble;
            while (ctx.measureText(text).width > max && text.length > 4) text = text.slice(0, -2);
            if (text !== bubble) text = text.trimEnd() + '…';
            const bw = ctx.measureText(text).width + 16;
            const ax = s.x;
            let bx = ax - bw / 2;
            bx = Math.max(6, Math.min(W - bw - 6, bx));
            // Globos escalonados para que los vecinos no se pisen.
            const alt = d.people.findIndex((x) => x.id === p.id) % 2 === 1;
            const by = s.y - 68 - (alt && !sel ? 24 : 0);
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = tone;
            rr(ctx, bx, by, bw, 21, 8);
            ctx.fill();
            if (alt && !sel) ctx.fillRect(ax - 1, by + 21, 2, 24);
            ctx.beginPath();
            ctx.moveTo(ax - 5, by + 21);
            ctx.lineTo(ax + 5, by + 21);
            ctx.lineTo(ax, by + 27);
            ctx.fill();
            ctx.fillStyle = '#13343d';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx + 8, by + 11);
          }

          ctx.globalAlpha = 1;
        });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    let best: string | null = null;
    let bd = 32;
    Object.entries(spritesRef.current).forEach(([id, s]) => {
      if (!s.visible) return;
      const dd = Math.hypot(s.x - x, s.y - 8 - y);
      if (dd < bd) {
        bd = dd;
        best = id;
      }
    });
    setSelected((cur) => (best && cur !== best ? best : null));
  }

  const people = data?.people ?? [];
  const afuera = people.filter((p) => placeOf(p) === 'afuera');
  const enOfi = people.filter((p) => placeOf(p) === 'oficina').length;
  const comiendo = people.filter((p) => placeOf(p) === 'comedor').length;
  const sel = people.find((p) => p.id === selected);

  return (
    <section className="card mb-5 overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" />
          </span>
          <h2 className="font-display text-base font-bold">Oficina en vivo</h2>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="badge bg-green/15 text-green">{enOfi} en la oficina</span>
          <span className="badge bg-yellow/15 text-yellow">{comiendo} comiendo</span>
          {data && data.stock_pending > 0 && (
            <span className="badge bg-pink/15 text-pink">{data.stock_pending} pedidos de stock</span>
          )}
        </div>
      </div>

      <div ref={wrapRef} className="w-full overflow-x-auto rounded-[12px] [contain:inline-size]">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="block max-w-none cursor-pointer rounded-[12px]"
          aria-label="Oficina animada con lo que está haciendo cada integrante del equipo"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red">{error}</p>}

      {sel ? (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-[10px] bg-bg-elevated px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-semibold">
              {sel.name} <span className="font-normal text-text-muted">· {sel.role_label}</span>
            </p>
            <p className="text-xs text-text-secondary">
              {sel.entrada_at ? `Entró ${horaAR(sel.entrada_at)}${sel.late_today ? ' · llegó tarde' : ''}` : 'Sin fichar'} · Tareas{' '}
              {sel.tasks_done}/{sel.tasks_total}
              {sel.stock_pending ? ` · ${sel.stock_pending} pedido(s) de stock esperando` : ''}
            </p>
            {sel.current_task && <p className="mt-1 text-xs text-text">Ahora: {sel.current_task}</p>}
          </div>
          <button onClick={() => setSelected(null)} className="text-xs text-text-muted">
            Cerrar
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-text-muted">
          {afuera.length > 0
            ? `Afuera: ${afuera
                .map((p) => (p.last_kind === 'salida' && p.last_at ? `${p.name} (salió ${horaAR(p.last_at)})` : `${p.name} (sin fichar)`))
                .join(' · ')}`
            : 'Está todo el equipo.'}{' '}
          · Tocá a alguien para ver qué está haciendo · Se actualiza solo cada 30 s
          {data ? ` · ${horaAR(new Date(nowMs))}` : ''}
        </p>
      )}
    </section>
  );
}

