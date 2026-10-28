'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { OficinaEnVivo } from '@/components/oficina/OficinaEnVivo';
import {
  buildSellerMetrics,
  buildTeamAverages,
  type Contact,
  type Period,
  type PeriodHistoryRow,
  type Seller,
} from '@/lib/calc';
import { SummaryTab } from '@/components/admin/SummaryTab';
import { SellersTab } from '@/components/admin/SellersTab';
import { ContactsTab } from '@/components/admin/ContactsTab';
import { FunnelTab } from '@/components/admin/FunnelTab';
import { RankingTab } from '@/components/admin/RankingTab';
import { WeekTab } from '@/components/admin/WeekTab';
import { HistoryTab } from '@/components/admin/HistoryTab';
import { GoalsTab } from '@/components/admin/GoalsTab';
import { AsistenciaTab } from '@/components/admin/AsistenciaTab';
import { StockAdminTab } from '@/components/admin/StockAdminTab';
import { EquipoAdminTab } from '@/components/admin/EquipoAdminTab';
import type { ClockEvent, SaturdayShift, Staff, StockRequest, Task, TaskTemplate } from '@/lib/oficina';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'embudo', label: 'Embudo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'semana', label: 'Semana' },
  { id: 'historico', label: 'Histórico' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'stock', label: 'Stock' },
  { id: 'equipo', label: 'Equipo' },
] as const;

type TabId = (typeof TABS)[number]['id'];
const OFICINA_TABS: readonly TabId[] = ['asistencia', 'stock', 'equipo'];

interface AdminDashboardProps {
  initialSellers: Seller[];
  initialPeriod: Period;
  initialContacts: Contact[];
  initialHistory: PeriodHistoryRow[];
  oficina: {
    today: string;
    staff: Staff[];
    events: ClockEvent[];
    tasks: Task[];
    templates: TaskTemplate[];
    stock: StockRequest[];
    shifts: SaturdayShift[];
  };
}

export function AdminDashboard({ initialSellers, initialPeriod, initialContacts, initialHistory, oficina }: AdminDashboardProps) {
  const [staff, setStaff] = useState<Staff[]>(oficina.staff);
  const [events, setEvents] = useState<ClockEvent[]>(oficina.events);
  const [tasks, setTasks] = useState<Task[]>(oficina.tasks);
  const [templates, setTemplates] = useState<TaskTemplate[]>(oficina.templates);
  const [stock, setStock] = useState<StockRequest[]>(oficina.stock);
  const stockPend = stock.filter((r) => r.status === 'pendiente' && r.trip_date >= oficina.today).length;
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const contacts = initialContacts;
  const [tab, setTab] = useState<TabId>('resumen');
  const supabase = useMemo(() => createClient(), []);

  const activeSellers = useMemo(() => sellers.filter((s) => s.active), [sellers]);

  const metrics = useMemo(
    () => activeSellers.map((s) => buildSellerMetrics(s, contacts, period)),
    [activeSellers, contacts, period]
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

      <nav className="mb-6 flex flex-col gap-2 border-b border-border pb-3">
        {(
          [
            ['Ventas', TABS.filter((t) => !OFICINA_TABS.includes(t.id))],
            ['Oficina', TABS.filter((t) => OFICINA_TABS.includes(t.id))],
          ] as const
        ).map(([group, list]) => (
          <div key={group} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] uppercase tracking-wide text-text-muted">{group}</span>
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-primary-bright text-bg'
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
        ))}
      </nav>

      {tab === 'resumen' && (
        <SummaryTab metrics={metrics} teamAverages={teamAverages} period={period} contacts={contacts} sellers={activeSellers} />
      )}
      {tab === 'vendedores' && <SellersTab metrics={metrics} teamAverages={teamAverages} />}
      {tab === 'clientes' && (
        <ContactsTab contacts={contacts} sellers={sellers} />
      )}
      {tab === 'embudo' && <FunnelTab metrics={metrics} />}
      {tab === 'ranking' && <RankingTab metrics={metrics} />}
      {tab === 'semana' && <WeekTab sellers={activeSellers} contacts={contacts} />}
      {tab === 'historico' && (
        <HistoryTab sellers={activeSellers} contacts={contacts} period={period} history={initialHistory} />
      )}
      {tab === 'objetivos' && (
        <GoalsTab
          sellers={sellers}
          period={period}
          history={initialHistory}
          onSellersChange={setSellers}
          onPeriodChange={setPeriod}
          supabase={supabase}
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
        <StockAdminTab staff={staff} requests={stock} today={oficina.today} supabase={supabase} onChange={setStock} />
      )}
      {tab === 'equipo' && (
        <EquipoAdminTab
          staff={staff}
          tasks={tasks}
          templates={templates}
          shifts={oficina.shifts}
          today={oficina.today}
          supabase={supabase}
          onStaffChange={setStaff}
          onTasksChange={setTasks}
          onTemplatesChange={setTemplates}
        />
      )}
    </main>
  );
}
