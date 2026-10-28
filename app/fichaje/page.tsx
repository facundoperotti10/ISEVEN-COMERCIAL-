import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Kiosk } from '@/components/fichaje/Kiosk';

export const metadata: Metadata = {
  title: 'Ingreso y egreso — ISEVEN',
};

export default async function FichajePage() {
  // Se arma en cada visita (como el resto de la app), no al compilar.
  await connection();
  return <Kiosk />;
}
