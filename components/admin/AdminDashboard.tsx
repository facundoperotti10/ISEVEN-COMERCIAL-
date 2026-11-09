'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { OficinaEnVivo } from '@/components/oficina/OficinaEnVivo';
import {
  buildSellerMetrics,
  buildTeamAverages,
  sellerArea,
  type ClientSale,
  type Contact,
  type Period,
  type PeriodHistoryRow,
  type Repair,
  type Seller,
} from '@/lib/calc';
import { SummaryTab } from '@/components/admin/SummaryTab';
import { SellersTab } from '@/components/admin/SellersTab';
import { ContactsTab } from '@/components/admin/ContactsTab';
import { TopClientsTab } from '@/components/admin/TopClientsTab';
import { ServicioTecnicoTab } from '@/components/admin/ServicioTecnicoTab';
import { FunnelTab } from '@/components/admin/FunnelTab';
import { RankingTab } from '@/components/admin/RankingTab';
import { WeekTab } from '@/components/admin/WeekTab';
import { HistoryTab } from '@/components/admin/HistoryTab';
import { GoalsTab } from '@/components/admin/GoalsTab';
import { AsistenciaTab } from '@/components/admin/AsistenciaTab';
import { StockAdminTab } from '@/components/admin/StockAdminTab';
import { EquipoAdminTab } from '@/components/admin/EquipoAdminTab';
import type {
  ClockEvent,
  ReservedUnit,
  SaturdayShift,
  Staff,
  StockLot,
  StockRequest,
  Task,
  TaskTemplate,
} from '@/lib/oficina';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'top-clientes', label: 'Top clientes' },
  { id: 'embudo', label: 'Embudo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'semana', label: 'Semana' },
  { id: 'historico', label: 'Histórico' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'arreglos', label: 'Arreglos' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'stock', label: 'Stock' },
  { id: 'equipo', label: 'Equipo' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Apartados del panel. Los de ventas muestran solo a los vendedores de esa área. */
const SECCIONES = [
  {
    id: 'minorista',
    label: 'Minorista',
    tabs: ['resumen', 'vendedores', 'clientes', 'embudo', 'ranking', 'semana', 'historico', 'objetivos'],
  },
  {
    id: 'mayorista',
    label: 'Mayorista',
    tabs: ['resumen', 'clientes', 'top-clientes', 'embudo', 'semana', 'historico', 'objetivos'],
  },
  { id: 'tecnico', label: 'Servicio técnico', tabs: ['arreglos'] },
  { id: 'oficina', label: 'Oficina', tabs: ['asistencia', 'stock', 'equipo'] },
] as const satisfies readonly { id: string; label: string; tabs: readonly TabId[] }[];

type SeccionId = (typeof SECCIONES)[number]['id'];

interface AdminDashboardProps {
  initialSellers: Seller[];
  initialPeriod: Period;
  initialContacts: Contact[];
  initialClientSales: ClientSale[];
  initialHistory: PeriodHistoryRow[];
  initialRepairs: Repair[];
  oficina: {
    today: string;
    staff: Staff[];
    events: ClockEvent[];
    tasks: Task[];
    templates: TaskTemplate[];
    stock: StockRequest[];
    shifts: SaturdayShift[];
    lots: StockLot[];
    units: ReservedUnit[];
  };
}

export function AdminDashboard({
  initialSellers,
  initialPeriod,
  initialContacts,
  initialClientSales,
  initialHistory,
  initialRepairs,
  oficina,
}: AdminDashboardProps) {
  const [repairs, setRepairs] = useState<Repair[]>(initialRepairs);
  const [staff, setStaff] = useState<Staff[]>(oficina.staff);
  const [events, setEvents] = useState<ClockEvent[]>(oficina.events);
  const [tasks, setTasks] = useState<Task[]>(oficina.tasks);
  const [stock, setStock] = useState<StockRequest[]>(oficina.stock);
  const [lots, setLots] = useState<StockLot[]>(oficina.lots);
  const [units, setUnits] = useState<ReservedUnit[]>(oficina.units);
  const stockPend = stock.filter((r) => r.status === 'pendiente' && r.trip_date >= oficina.today).length;
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [seccion, setSeccion] = useState<SeccionId>('minorista');
  const [tab, setTab] = useState<TabId>('resumen');
  const supabase = useMemo(() => createClient(), []);
  const seccionActual = SECCIONES.find((s) => s.id === seccion)!;
  const tabsSeccion = TABS.filter((t) => (seccionActual.tabs as readonly TabId[]).includes(t.id));

  function cambiarSeccion(id: SeccionId) {
    setSeccion(id);
    const tabs = SECCIONES.find((s) => s.id === id)!.tabs as readonly TabId[];
    if (!tabs.includes(tab)) setTab(tabs[0]);
  }

  // Datos de ventas del área elegida (en Oficina no se usan).
  const areaSellers = useMemo(() => sellers.filter((s) => sellerArea(s) === seccion), [sellers, seccion]);
  const areaIds = useMemo(() => new Set(areaSellers.map((s) => s.id)), [areaSellers]);
  const contacts = useMemo(() => initialContacts.filter((c) => areaIds.has(c.seller_id)), [initialContacts, areaIds]);
  const clientSales = useMemo(
    () => initialClientSales.filter((s) => areaIds.has(s.seller_id)),
    [initialClientSales, areaIds]
  );
  const history = useMemo(() => initialHistory.filter((h) => areaIds.has(h.seller_id)), [initialHistory, areaIds]);

  const activeSellers = useMemo(() => areaSellers.filter((s) => s.active), [areaSellers]);

  const metrics = useMemo(
    () => activeSellers.map((s) => buildSellerMetrics(s, contacts, period, new Date(), clientSales)),
    [activeSellers, contacts, period, clientSales]
  );

  const teamAverages = useMemo(() => buildTeamAverages(metrics), [metrics]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Panel de control</h1>
          <p className="text-xs text-text-muted">{period.name}</p>
        </div>
        <LogoutButton />
      </header>

      <OficinaEnVivo />

      <nav className="mb-6 flex flex-col gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap gap-2">
          {SECCIONES.map((sec) => (
            <button
              key={sec.id}
              onClick={() => cambiarSeccion(sec.id)}
              className={`rounded-[10px] border px-4 py-2 font-display text-sm font-bold transition ${
                seccion === sec.id
                  ? 'border-primary-bright bg-primary-bright text-bg'
                  : 'border-border bg-bg-elevated text-text-secondary hover:text-text'
              }`}
            >
              {sec.label}
              {sec.id === 'oficina' && stockPend > 0 && (
                <span className="ml-1.5 rounded-full bg-orange px-1.5 text-[10px] font-bold text-bg">{stockPend}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tabsSeccion.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-primary-bright/20 text-text'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text'
              }`}
            >
              {t.label}
              {t.id === 'stock' && stockPend > 0 && (
                <span className="ml-1.5 rounded-full bg-orange px-1.5 text-[10px] font-bold text-bg">{stockPend}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div key={seccion}>

      {tab === 'resumen' && (
        <SummaryTab
          metrics={metrics}
          teamAverages={teamAverages}
          period={period}
          contacts={contacts}
          clientSales={clientSales}
          sellers={activeSellers}
        />
      )}
      {tab === 'vendedores' && <SellersTab metrics={metrics} teamAverages={teamAverages} />}
      {tab === 'clientes' && (
        <ContactsTab contacts={contacts} sellers={areaSellers} />
      )}
      {tab === 'top-clientes' && (
        <TopClientsTab
          contacts={contacts}
          clientSales={clientSales}
          sellers={areaSellers}
          period={period}
          today={oficina.today}
        />
      )}
      {tab === 'embudo' && <FunnelTab metrics={metrics} />}
      {tab === 'ranking' && <RankingTab metrics={metrics} />}
      {tab === 'semana' && <WeekTab sellers={activeSellers} contacts={contacts} clientSales={clientSales} />}
      {tab === 'historico' && (
        <HistoryTab
          sellers={activeSellers}
          contacts={contacts}
          clientSales={clientSales}
          period={period}
          history={history}
        />
      )}
      {tab === 'objetivos' && (
        <GoalsTab
          sellers={areaSellers}
          period={period}
          history={history}
          onSellersChange={(updated) =>
            setSellers((prev) => prev.map((s) => updated.find((u) => u.id === s.id) ?? s))
          }
          onPeriodChange={setPeriod}
          supabase={supabase}
        />
      )}
      {tab === 'arreglos' && (
        <ServicioTecnicoTab
          repairs={repairs}
          sellers={sellers}
          today={oficina.today}
          supabase={supabase}
          onChange={setRepairs}
        />
      )}
      {tab === 'asistencia' && (
        <AsistenciaTab
          staff={staff}
          events={events}
          today={oficina.today}
          supabase={supabase}
          onEventsChange={(e) => setEvents([...e].sort((a, b) => a.at.localeCompare(b.at)))}
        />
      )}
      {tab === 'stock' && (
        <StockAdminTab
          staff={staff}
          requests={stock}
          today={oficina.today}
          supabase={supabase}
          onChange={setStock}
          lots={lots}
          units={units}
          onCupoChange={(l, u) => {
            setLots(l);
            setUnits(u);
          }}
        />
      )}
      {tab === 'equipo' && (
        <EquipoAdminTab
          staff={staff}
          tasks={tasks}
          shifts={oficina.shifts}
          today={oficina.today}
          supabase={supabase}
          onStaffChange={setStaff}
          onTasksChange={setTasks}
        />
      )}
      </div>
    </main>
  );
}
