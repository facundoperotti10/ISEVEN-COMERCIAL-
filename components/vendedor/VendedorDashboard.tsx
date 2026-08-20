'use client';

import { useMemo, useState } from 'react';
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
import {
  buildSellerMetrics,
  ESTADOS,
  salesByDay,
  type Contact,
  type Period,
  type Seller,
} from '@/lib/calc';
import type { ContactEstado } from '@/lib/database.types';

interface VendedorDashboardProps {
  seller: Seller;
  period: Period;
  initialContacts: Contact[];
  sellerName: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VendedorDashboard({ seller, period, initialContacts, sellerName }: VendedorDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [dateFilter, setDateFilter] = useState<'all' | string>('all');
  const [estadoFilter, setEstadoFilter] = useState<'todos' | ContactEstado>('todos');
  const supabase = useMemo(() => createClient(), []);
  const today = todayISO();

  const metrics = useMemo(() => buildSellerMetrics(seller, contacts, period), [seller, contacts, period]);
  const dailySales = useMemo(() => salesByDay(seller.id, contacts, period), [seller.id, contacts, period]);
  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (dateFilter === 'all' || c.date === dateFilter) &&
          (estadoFilter === 'todos' || c.estado === estadoFilter)
      ),
    [contacts, dateFilter, estadoFilter]
  );

  async function handleAdd(data: { nombre: string; telefono: string; estado: ContactEstado; observacion: string }) {
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Contact = {
      id: optimisticId,
      seller_id: seller.id,
      date: today,
      nombre: data.nombre,
      telefono: data.telefono || null,
      estado: data.estado,
      observacion: data.observacion || null,
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
      })
      .select()
      .single();

    if (error || !inserted) {
      setContacts((prev) => prev.filter((c) => c.id !== optimisticId));
      return;
    }

    setContacts((prev) => prev.map((c) => (c.id === optimisticId ? inserted : c)));
  }

  async function handleUpdate(id: string, patch: Partial<Pick<Contact, 'estado' | 'observacion'>>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from('contacts').update(patch).eq('id', id);
  }

  async function handleDelete(id: string) {
    const prev = contacts;
    setContacts((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) setContacts(prev);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-text">Hola, {sellerName}</h1>
          <p className="text-xs text-text-muted">{period.name}</p>
        </div>
        <LogoutButton />
      </header>

      <div className="flex flex-col gap-4">
        <BonusCard
          bonusUsd={seller.bonus_usd}
          currentSales={metrics.currentSales}
          target={seller.target}
          remainingSales={metrics.remainingSales}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Objetivo" value={seller.target} />
          <KpiCard label="Ventas actuales" value={metrics.currentSales} accent="#2C8598" />
          <KpiCard label="Faltantes" value={metrics.remainingSales} accent="#FF8123" />
          <KpiCard label="Proyección al cierre" value={Math.round(metrics.proyeccionCierre)} />
        </div>

        <RespondidosCard respondidos={metrics.respondidos} convRespondidos={metrics.convRespondidos} />

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

        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-bold text-text">Ventas por día</h2>
          <SalesLineChart data={dailySales} />
        </div>
      </div>
    </main>
  );
}
