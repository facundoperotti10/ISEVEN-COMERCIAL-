'use client';

import { useEffect } from 'react';

export interface CelebrationTrigger {
  id: number;
  nombre: string;
}

interface SaleCelebrationProps {
  trigger: CelebrationTrigger | null;
  onDone: () => void;
}

const COLORS = ['#FF8123', '#FE8BEA', '#2C8598', '#4ADE80', '#C9C6E5'];

export function SaleCelebration({ trigger, onDone }: SaleCelebrationProps) {
  useEffect(() => {
    if (!trigger) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.3 }, colors: COLORS });
        confetti({ particleCount: 50, spread: 90, origin: { y: 0.4, x: 0.15 }, angle: 60, colors: COLORS });
        confetti({ particleCount: 50, spread: 90, origin: { y: 0.4, x: 0.85 }, angle: 120, colors: COLORS });
      });
    }

    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [trigger, onDone]);

  if (!trigger) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className="pointer-events-auto animate-[celebration-pop_0.3s_ease-out] rounded-[14px] px-5 py-3 text-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #FF8123 0%, #FE8BEA 100%)' }}
      >
        <p className="font-display text-sm font-bold text-bg">🎉 ¡Venta cargada!</p>
        <p className="text-xs font-medium text-bg/80">{trigger.nombre}</p>
      </div>
      <style>{`
        @keyframes celebration-pop {
          from { transform: translateY(-12px) scale(0.92); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
