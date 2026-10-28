import type { Metadata } from 'next';
import { Kiosk } from '@/components/fichaje/Kiosk';

export const metadata: Metadata = {
  title: 'Ingreso y egreso — ISEVEN',
};

export default function FichajePage() {
  return <Kiosk />;
}
