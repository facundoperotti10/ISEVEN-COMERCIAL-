import { redirect } from 'next/navigation';
import { getSessionProfile, homePath } from '@/lib/auth';
import { LoginScreen } from '@/components/login/LoginScreen';

export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile) redirect(homePath(profile));

  return <LoginScreen />;
}
