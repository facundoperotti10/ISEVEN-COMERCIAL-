'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { OficinaEnVivo } from '@/components/oficina/OficinaEnVivo';
import { createClient } from '@/lib/supabase/client';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { KpiCard } from '@/components/ui/KpiCard';
import { PaceGauge } from '@/components/ui/PaceGauge';
import { SemaforoBadge } from '@/components/ui/SemaforoBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SalesLineChart } from '@/components/ui/SalesLineChart';
import { BonusCard } from '@/components/vendedor/BonusCard';
import { RespondidosCard } from '@/components/vendedor/RespondidosCard';
import { ContactForm } from '@/components/vendedor/ContactForm';
import { ContactsList } from '@/components/vendedor/ContactsList';
import { DailyReportCard } from '@/components/vendedor/DailyReportCard';
import { SeguimientoReminder } from '@/components/vendedor/SeguimientoReminder';
import { SaleCelebration, type CelebrationTrigger } from '@/components/vendedor/SaleCelebration';
import { TeamRanking } from '@/components/vendedor/TeamRanking';
import {
  buildSellerMetrics,
  buildTeamRanking,
  ESTADOS,
  salesByDay,
  seguimientosPendientes,
  type Contact,
  type Period,
  type Seller,
  type TeamRankingRaw,
  todayAR,
} from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

/**
 * true si Supabase rechazó el pedido porque la columna `fuente` todavía no
 * existe en la base (la migración no se corrió). Permite reintentar sin ese
 * campo en vez de que se rompa la carga de clientes por completo.
 */
function isMissingFuenteColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const message = e?.message ?? '';
  return e?.code === 'PGRST204' || (/fuente/i.test(message) && /column|schema/i.test(message));
}

interface VendedorDashboardProps {
  seller: Seller;
  period: Period;
  initialContacts: Contact[];
  initialRanking: TeamRankingRaw[];
  sellerName: string;
}

export function VendedorDashboard({
  seller,
  period,
  initialContacts,
  initialRanking,
  sellerName,
}: VendedorDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [dateFilter, setDateFilter] = useState<'all' | string>('all');
  const [estadoFilter, setEstadoFilter] = useState<'todos' | ContactEstado>('todos');
  const [celebration, setCelebration] = useState<CelebrationTrigger | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const supabase = useMemo(() => createClient(), []);
  const today = todayAR();

  const metrics = useMemo(() => buildSellerMetrics(seller, contacts, period), [seller, contacts, period]);
  const dailySales = useMemo(() => salesByDay(seller.id, contacts, period), [seller.id, contacts, period]);
  const pendientes = useMemo(
    () => seguimientosPendientes(seller.id, contacts, today),
    [seller.id, contacts, today]
  );
  const ranking = useMemo(() => {
    const base = buildTeamRanking(initialRanking);
    return base
      .map((r) =>
        r.sellerId === seller.id
          ? { ...r, sales: metrics.currentSales, cumplimientoPct: metrics.cumplimientoPct }
          : r
      )
      .sort((a, b) => b.cumplimientoPct - a.cumplimientoPct);
  }, [initialRanking, seller.id, metrics.currentSales, metrics.cumplimientoPct]);
  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (dateFilter === 'all' || c.date === dateFilter) &&
          (estadoFilter === 'todos' || c.estado === estadoFilter)
      ),
    [contacts, dateFilter, estadoFilter]
  );

  async function handleAdd(data: {
    nombre: string;
    telefono: string;
    estado: ContactEstado;
    observacion: string;
    fuente: string;
  }): Promise<boolean> {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Contact = {
      id: optimisticId,
      seller_id: seller.id,
      date: today,
      nombre: data.nombre,
      telefono: data.telefono || null,
      estado: data.estado,
      observacion: data.observacion || null,
      fuente: data.fuente || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setContacts((prev) => [optimistic, ...prev]);

    let { data: inserted, error } = await supabase
      .from('contacts')
      .insert({
        seller_id: seller.id,
        date: today,
        nombre: data.nombre,
        telefono: data.telefono || null,
        estado: data.estado,
        observacion: data.observacion || null,
        fuente: data.fuente || null,
      })
      .select()
      .single();

    if (error && isMissingFuenteColumn(error)) {
      ({ data: inserted, error } = await supabase
        .from('contacts')
        .insert({
          seller_id: seller.id,
          date: today,
          nombre: data.nombre,
          telefono: data.telefono || null,
          estado: data.estado,
          observacion: data.observacion || null,
        })
        .select()
        .single());
    }

    if (error || !inserted) {
      console.error('No se pudo guardar el cliente:', error);
      setContacts((prev) => prev.filter((c) => c.id !== optimisticId));
      return false;
    }

    setContacts((prev) => prev.map((c) => (c.id === optimisticId ? inserted : c)));
    if (inserted.estado === 'vendido') {
      setCelebration({ id: Date.now(), nombre: inserted.nombre });
    }
    return true;
  }

  async function handleUpdate(id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion' | 'fuente'>>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (patch.estado === 'vendido') {
      const contact = contacts.find((c) => c.id === id);
      if (contact) setCelebration({ id: Date.now(), nombre: contact.nombre });
    }

    const { error } = await supabase.from('contacts').update(patch).eq('id', id);

    if (error && isMissingFuenteColumn(error) && 'fuente' in patch) {
      const fallbackPatch: Partial<Pick<Contact, 'estado' | 'observacion'>> = {};
      if (patch.estado !== undefined) fallbackPatch.estado = patch.estado;
      if (patch.observacion !== undefined) fallbackPatch.observacion = patch.observacion;
      if (Object.keys(fallbackPatch).length > 0) {
        const { error: fallbackError } = await supabase.from('contacts').update(fallbackPatch).eq('id', id);
        if (fallbackError) {
          console.error('No se pudo actualizar el cliente:', fallbackError);
        }
      }
    } else if (error) {
      console.error('No se pudo actualizar el cliente:', error);
    }
  }

  async function handleDelete(id: string) {
    const prev = contacts;
    setContacts((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) setContacts(prev);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <SaleCelebration trigger={celebration} onDone={dismissCelebration} />

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Hola, {sellerName}</h1>
          <p className="text-xs text-text-muted">{period.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/equipo"
            className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-bg transition hover:brightness-110"
          >
            Oficina: tareas, stock y sábados
          </Link>
          <LogoutButton />
        </div>
      </header>

      <OficinaEnVivo />

      <div className="flex flex-col gap-4">
        <BonusCard
          bonusUsd={seller.bonus_usd}
          currentSales={metrics.currentSales}
          target={seller.target}
          remainingSales={metrics.remainingSales}
        />

        <SeguimientoReminder pendientes={pendientes} onUpdate={handleUpdate} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Objetivo" value={seller.target} />
          <KpiCard label="Ventas actuales" value={metrics.currentSales} accent="#2C8598" />
          <KpiCard label="Faltantes" value={metrics.remainingSales} accent="#FF8123" />
          <KpiCard label="Proyección al cierre" value={Math.round(metrics.proyeccionCierre)} />
        </div>

        <RespondidosCard respondidos={metrics.respondidos} convRespondidos={metrics.convRespondidos} />

        <TeamRanking ranking={ranking} currentSellerId={seller.id} />

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-text-secondary">Progreso hacia el objetivo</span>
            <SemaforoBadge semaforo={metrics.semaforo} />
          </div>
          <ProgressBar value={metrics.cumplimientoPct} color="#2C8598" />
          <div className="mt-4">
            <PaceGauge
              paceActual={metrics.paceActual}
              paceNeeded={metrics.paceNeeded}
              semaforo={metrics.semaforo}
              label="Ritmo de ventas"
            />
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Cargar cliente de hoy</h2>
          <ContactForm onAdd={handleAdd} />
        </div>

        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-text">Mis clientes</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDateFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  dateFilter === 'all'
                    ? 'bg-primary-bright text-bg'
                    : 'bg-bg-elevated text-text-secondary hover:text-text'
                }`}
              >
                Todos los días
              </button>
              <button
                onClick={() => setDateFilter(today)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  dateFilter === today
                    ? 'bg-primary-bright text-bg'
                    : 'bg-bg-elevated text-text-secondary hover:text-text'
                }`}
              >
                Hoy
              </button>
              <input
                type="date"
                value={dateFilter === 'all' ? '' : dateFilter}
                onChange={(e) => setDateFilter(e.target.value || 'all')}
                className="rounded-[10px] border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text focus:border-primary-bright focus:outline-none"
              />
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value as 'todos' | ContactEstado)}
                className="rounded-[10px] border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text focus:border-primary-bright focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ContactsList
            contacts={filteredContacts}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            emptyMessage={
              dateFilter === 'all' && estadoFilter === 'todos'
                ? 'Todavía no cargaste clientes.'
                : 'No hay clientes que coincidan con el filtro.'
            }
          />
        </div>

        <DailyReportCard
          seller={seller}
          sellerName={sellerName}
          period={period}
          metrics={metrics}
          contacts={contacts}
          today={today}
        />

        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Ventas por día</h2>
          <SalesLineChart data={dailySales} />
        </div>
      </div>
    </main>
  );
}
