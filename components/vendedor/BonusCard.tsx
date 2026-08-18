import { ProgressBar } from '@/components/ui/ProgressBar';

interface BonusCardProps {
  bonusUsd: number;
  currentSales: number;
  target: number;
  remainingSales: number;
}

export function BonusCard({ bonusUsd, currentSales, target, remainingSales }: BonusCardProps) {
  const achieved = remainingSales <= 0;
  const progressPct = target > 0 ? Math.min((currentSales / target) * 100, 100) : 0;

  return (
    <div
      className="card p-5"
      style={
        achieved
          ? { background: 'linear-gradient(135deg, #1B5968 0%, #2C8598 100%)' }
          : { background: 'linear-gradient(135deg, #FF8123 0%, #FE8BEA 100%)' }
      }
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold text-bg">
          🎯💰 BONO: USD {bonusUsd}
        </div>
        {achieved && (
          <div className="font-display text-sm font-bold text-bg">¡Objetivo alcanzado! 🎉</div>
        )}
      </div>

      <div className="mt-3">
        <ProgressBar value={progressPct} color="#0C2429" height={12} />
      </div>

      <p className="mt-3 text-sm font-medium text-bg/90">
        {achieved
          ? 'Objetivo cumplido. El bono ya está desbloqueado.'
          : `Te faltan ${remainingSales} venta${remainingSales === 1 ? '' : 's'} para el objetivo y para desbloquear tu bono.`}
      </p>
    </div>
  );
}
