'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import {
  buildSellerMetrics,
  buildTeamAverages,
  type Contact,
  type Period,
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

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'vendedores', label: 'Vendedores' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'embudo', label: 'Embudo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'semana', label: 'Semana' },
  { id: 'historico', label: 'Histórico' },
  { id: 'objetivos', label: 'Objetivos' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface AdminDashboardProps {
  initialSellers: Seller[];
  initialPeriod: Period;
  initialContacts: Contact[];
}

export function AdminDashboard({ initialSellers, initialPeriod, initialContacts }: AdminDashboardProps) {
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

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
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
          </button>
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
      {tab === 'historico' && <HistoryTab sellers={activeSellers} contacts={contacts} period={period} />}
      {tab === 'objetivos' && (
        <GoalsTab
          sellers={sellers}
          period={period}
          onSellersChange={setSellers}
          onPeriodChange={setPeriod}
          supabase={supabase}
        />
      )}
    </main>
  );
}
