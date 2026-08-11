import { Redirect } from 'expo-router';

import { useAuth } from '../lib/auth';

export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') return null;

  if (status === 'unconfigured') return <Redirect href="/server-link" />;
  if (status === 'unauthenticated') return <Redirect href="/login" />;

  return <Redirect href="/(tabs)" />;
}
