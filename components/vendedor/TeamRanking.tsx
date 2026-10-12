'use client';

import { formatPct, type TeamRankingRow } from '@/lib/calc';

interface TeamRankingProps {
  ranking: TeamRankingRow[];
  currentSellerId: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function TeamRanking({ ranking, currentSellerId }: TeamRankingProps) {
  if (ranking.length === 0) return null;

  return (
    <div className="card p-4">
      <h2 className="mb-3 font-display text-sm font-bold text-text">Ranking del equipo</h2>
      <ol className="flex flex-col gap-2">
        {ranking.map((r, i) => {
          const isMe = r.sellerId === currentSellerId;
          return (
            <li
              key={r.sellerId}
              className={`flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2.5 ${
                isMe ? 'border-primary-bright bg-primary/15' : 'border-border bg-bg-elevated'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 text-center text-base">{MEDALS[i] ?? `${i + 1}º`}</span>
                <span className={`text-sm ${isMe ? 'font-bold text-text' : 'text-text-secondary'}`}>
                  {r.sellerName}
                  {isMe && <span className="ml-1.5 text-xs text-text-muted">(vos)</span>}
                </span>
              </div>
              <div className="text-right">
                <div className="stat-number text-sm text-text">{r.sales}</div>
                <div className="text-[10px] text-text-muted">{formatPct(r.cumplimientoPct)} cumplido</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
