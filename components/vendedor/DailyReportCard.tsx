'use client';

import { useMemo, useState } from 'react';
import type { Contact, Period, Seller, SellerMetrics } from '@/lib/calc';
import { buildDailyReportData, buildDailyReportText } from '@/lib/report';

interface DailyReportCardProps {
  seller: Seller;
  sellerName: string;
  period: Period;
  metrics: SellerMetrics;
  contacts: Contact[];
  today: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores que bloquean el portapapeles
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function DailyReportCard({ seller, sellerName, period, metrics, contacts, today }: DailyReportCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const data = buildDailyReportData(seller.id, contacts, today);
    return buildDailyReportText(sellerName, seller, period, metrics, data);
  }, [seller, sellerName, period, metrics, contacts, today]);

  async function handleCopy() {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="card border-orange p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold text-text">Cierre del día</h2>
          <p className="text-xs text-text-secondary">Generá tu reporte y mandáselo a Facu.</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-[10px] bg-orange px-4 py-2 text-sm font-medium text-bg hover:brightness-110"
          >
            Generar reporte
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-[10px] border border-border bg-bg-elevated p-3 font-body text-xs leading-relaxed text-text">
            {text}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="rounded-[10px] bg-orange px-4 py-2 text-sm font-medium text-bg hover:brightness-110"
            >
              {copied ? '✓ Reporte copiado' : 'Copiar reporte'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-text hover:border-primary-bright"
            >
              Enviar por WhatsApp
            </a>
            <button
              onClick={() => setOpen(false)}
              className="rounded-[10px] px-3 py-2 text-sm text-text-secondary hover:text-text"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
