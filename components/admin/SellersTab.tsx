'use client';

import { PaceGauge } from '@/components/ui/PaceGauge';
import { SemaforoBadge } from '@/components/ui/SemaforoBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  diagnosticar,
  DIAGNOSTICO_LABEL,
  formatPct,
  type SellerMetrics,
  type TeamAverages,
} from '@/lib/calc';

interface SellersTabProps {
  metrics: SellerMetrics[];
  teamAverages: TeamAverages;
}

export function SellersTab({ metrics, teamAverages }: SellersTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((m) => {
        const diag = diagnosticar(m, teamAverages);
        return (
          <div key={m.seller.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-text">{m.seller.name}</h3>
              <SemaforoBadge semaforo={m.semaforo} />
            </div>

            <div className="mb-3 rounded-[10px] p-3" style={{ background: 'linear-gradient(135deg, #FF8123 0%, #FE8BEA 100%)' }}>
              <span className="text-sm font-bold text-bg">🎯💰 Bono USD {m.seller.bonus_usd}</span>
            </div>

            <ProgressBar value={m.cumplimientoPct} />

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="stat-number text-lg">{m.currentSales}</div>
                <div className="text-text-muted">Ventas</div>
              </div>
              <div>
                <div className="stat-number text-lg">{m.seller.target}</div>
                <div className="text-text-muted">Objetivo</div>
              </div>
              <div>
                <div className="stat-number text-lg">{m.remainingSales}</div>
                <div className="text-text-muted">Faltan</div>
              </div>
              <div>
                <div className="stat-number text-lg">{m.consultas}</div>
                <div className="text-text-muted">Consultas</div>
              </div>
              <div>
                <div className="stat-number text-lg">{m.respondidos}</div>
                <div className="text-text-muted">Respondieron</div>
              </div>
              <div>
                <div className="stat-number text-lg">{formatPct(m.convRespondidos)}</div>
                <div className="text-text-muted">% cierre</div>
              </div>
            </div>

            <div className="mt-4">
              <PaceGauge paceActual={m.paceActual} paceNeeded={m.paceNeeded} semaforo={m.semaforo} />
            </div>

            <p className="mt-3 text-xs text-text-secondary">{DIAGNOSTICO_LABEL[diag]}</p>
          </div>
        );
      })}
    </div>
  );
}
