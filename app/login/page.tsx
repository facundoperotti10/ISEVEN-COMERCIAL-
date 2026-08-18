import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { LoginScreen } from '@/components/login/LoginScreen';

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role === 'admin' ? '/admin' : '/vendedor');

  return <LoginScreen />;
}
