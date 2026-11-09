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
import { ClientsFolder } from '@/components/vendedor/ClientsFolder';
import { DailyReportCard } from '@/components/vendedor/DailyReportCard';
import { SeguimientoReminder } from '@/components/vendedor/SeguimientoReminder';
import { SaleCelebration, type CelebrationTrigger } from '@/components/vendedor/SaleCelebration';
import { TeamRanking } from '@/components/vendedor/TeamRanking';
import {
  buildSellerMetrics,
  buildTeamRanking,
  salesByDay,
  seguimientosPendientes,
  sellerArea,
  type AccessorySale,
  type ClientSale,
  type Contact,
  type Period,
  type Seller,
  type TeamRankingRaw,
  todayAR,
} from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

/** Texto corto con el código y mensaje de Supabase, para que el vendedor lo mande por soporte. */
function describeSupabaseError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return 'sin respuesta del servidor (puede ser falta de conexión)';
  return [e.code, e.message].filter(Boolean).join(' - ') || 'error desconocido';
}

interface VendedorDashboardProps {
  seller: Seller;
  period: Period;
  initialContacts: Contact[];
  initialClientSales: ClientSale[];
  initialAccessorySales?: AccessorySale[];
  initialRanking: TeamRankingRaw[];
  sellerName: string;
}

export function VendedorDashboard({
  seller,
  period,
  initialContacts,
  initialClientSales,
  initialAccessorySales = [],
  initialRanking,
  sellerName,
}: VendedorDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [clientSales, setClientSales] = useState<ClientSale[]>(initialClientSales);
  const [accessorySales, setAccessorySales] = useState<AccessorySale[]>(initialAccessorySales);
  const esMayorista = sellerArea(seller) === 'mayorista';
  const [tab, setTab] = useState<'hoy' | 'clientes' | 'progreso'>('hoy');
  const [celebration, setCelebration] = useState<CelebrationTrigger | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const supabase = useMemo(() => createClient(), []);
  const today = todayAR();

  const metrics = useMemo(
    () => buildSellerMetrics(seller, contacts, period, new Date(), clientSales),
    [seller, contacts, period, clientSales]
  );
  const dailySales = useMemo(
    () => salesByDay(seller.id, contacts, period, clientSales),
    [seller.id, contacts, period, clientSales]
  );
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
  const todayCount = useMemo(() => contacts.filter((c) => c.date === today).length, [contacts, today]);

  async function handleAdd(data: {
    nombre: string;
    telefono: string;
    estado: ContactEstado;
    observacion: string;
    fuente: string;
  }): Promise<string | null> {
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

    const { data: inserted, error } = await supabase
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

    if (error || !inserted) {
      console.error('No se pudo guardar el cliente:', error);
      setContacts((prev) => prev.filter((c) => c.id !== optimisticId));
      return describeSupabaseError(error);
    }

    setContacts((prev) => prev.map((c) => (c.id === optimisticId ? inserted : c)));
    if (inserted.estado === 'vendido') {
      setCelebration({ id: Date.now(), nombre: inserted.nombre });
    }
    return null;
  }

  async function handleUpdate(id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion' | 'fuente'>>) {
    const prev = contacts;
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (patch.estado === 'vendido') {
      const contact = contacts.find((c) => c.id === id);
      if (contact) setCelebration({ id: Date.now(), nombre: contact.nombre });
    }

    const { error } = await supabase.from('contacts').update(patch).eq('id', id);

    if (error) {
      console.error('No se pudo actualizar el cliente:', error);
      setContacts(prev);
    }
  }

  async function handleDelete(id: string) {
    const prev = contacts;
    setContacts((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) setContacts(prev);
  }

  async function handleAddSale(contactId: string) {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ClientSale = {
      id: optimisticId,
      contact_id: contactId,
      seller_id: seller.id,
      date: today,
      created_at: new Date().toISOString(),
    };
    setClientSales((prev) => [optimistic, ...prev]);

    const { data: inserted, error } = await supabase
      .from('client_sales')
      .insert({ contact_id: contactId, seller_id: seller.id })
      .select()
      .single();

    if (error || !inserted) {
      console.error('No se pudo registrar la venta:', error);
      setClientSales((prev) => prev.filter((s) => s.id !== optimisticId));
      return;
    }
    setClientSales((prev) => prev.map((s) => (s.id === optimisticId ? inserted : s)));
  }

  async function handleAddAccessory(contactId: string, descripcion: string, cantidad: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('accessory_sales')
      .insert({ contact_id: contactId, seller_id: seller.id, date: today, descripcion, cantidad })
      .select()
      .single();
    if (error || !data) {
      console.error('No se pudo cargar el accesorio:', error);
      return `No se pudo guardar. Para soporte, mandá esto: ${describeSupabaseError(error)}`;
    }
    setAccessorySales((prev) => [data, ...prev]);
    return null;
  }

  async function handleDeleteAccessory(id: string) {
    const prev = accessorySales;
    setAccessorySales((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from('accessory_sales').delete().eq('id', id);
    if (error) setAccessorySales(prev);
  }

  const accesoriosMes = useMemo(
    () =>
      accessorySales
        .filter((a) => a.date >= period.start_date && a.date <= period.end_date)
        .reduce((acc, a) => acc + a.cantidad, 0),
    [accessorySales, period.start_date, period.end_date]
  );

  async function handleDeleteSale(id: string) {
    const prev = clientSales;
    setClientSales((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from('client_sales').delete().eq('id', id);
    if (error) setClientSales(prev);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <SaleCelebration trigger={celebration} onDone={dismissCelebration} />

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Hola, {sellerName}</h1>
          <p className="text-xs text-text-muted">{period.name}</p>
        </div>
        <LogoutButton />
      </header>

      <OficinaEnVivo />

      <nav className="mb-5 flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ['hoy', 'Hoy'],
            ['clientes', `Clientes (${contacts.length})`],
            ['progreso', 'Mi progreso'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === id ? 'bg-primary-bright text-bg' : 'text-text-secondary hover:bg-bg-elevated hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
        <Link
          href="/equipo"
          className="rounded-full px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-bg-elevated hover:text-text"
        >
          Oficina: tareas, stock y sábados →
        </Link>
      </nav>

      {tab === 'hoy' && (
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

          {esMayorista && (
            <button
              onClick={() => setTab('clientes')}
              className="card flex items-center justify-between px-4 py-3 text-left"
            >
              <span>
                <span className="block text-xs text-text-secondary">Accesorios vendidos este mes</span>
                <span className="block text-[11px] text-text-muted">
                  Aparte del objetivo de equipos · se cargan desde cada cliente
                </span>
              </span>
              <span className="stat-number text-2xl text-lilac">{accesoriosMes}</span>
            </button>
          )}

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-text">Cargar cliente de hoy</h2>
              <button onClick={() => setTab('clientes')} className="text-xs text-text-secondary underline underline-offset-4">
                Hoy cargaste {todayCount} · Ver todos mis clientes
              </button>
            </div>
            <ContactForm onAdd={handleAdd} />
          </div>
        </div>
      )}

      {tab === 'clientes' && (
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Mis clientes</h2>
          <ClientsFolder
            contacts={contacts}
            clientSales={clientSales}
            today={today}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddSale={handleAddSale}
            onDeleteSale={handleDeleteSale}
            {...(esMayorista
              ? { accessorySales, onAddAccessory: handleAddAccessory, onDeleteAccessory: handleDeleteAccessory }
              : {})}
          />
        </div>
      )}

      {tab === 'progreso' && (
        <div className="flex flex-col gap-4">
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

          <RespondidosCard respondidos={metrics.respondidos} convRespondidos={metrics.convRespondidos} />

          <TeamRanking ranking={ranking} currentSellerId={seller.id} />

          <div className="card p-4">
            <h2 className="mb-3 font-display text-sm font-bold text-text">Ventas por día</h2>
            <SalesLineChart data={dailySales} />
          </div>

          <DailyReportCard
            seller={seller}
            sellerName={sellerName}
            period={period}
            metrics={metrics}
            contacts={contacts}
            clientSales={clientSales}
            accessorySales={accessorySales}
            today={today}
          />
        </div>
      )}
    </main>
  );
}
