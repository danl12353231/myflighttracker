import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { User } from './router';
import {
  clearToken,
  clearServerUrl,
  getServerUrl,
  getToken,
  setServerUrl,
  setToken,
} from './storage';
import {
  createTrpcClient,
  invalidateClient,
} from './trpc';

type AuthState = {
  status: 'loading' | 'unconfigured' | 'unauthenticated' | 'authenticated';
  serverUrl: string | null;
  token: string | null;
  user: User | null;
  configureServer: (url: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearServer: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [reload, setReload] = useState(0);

  const queryClient = useMemo(() => new QueryClient(), [reload]);

  useEffect(() => {
    (async () => {
      const url = await getServerUrl();
      const tok = await getToken();
      setServerUrlState(url);
      setTokenState(tok);
      if (!url) {
        setStatus('unconfigured');
        return;
      }
      if (!tok) {
        setStatus('unauthenticated');
        return;
      }
      setStatus('authenticated');
    })();
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const client = createTrpcClient(serverUrl!, token!);
    client.user.me
      .query()
      .then((me: User) => setUser(me))
      .catch(() => {
        clearToken();
        setTokenState(null);
        setUser(null);
        setStatus('unauthenticated');
      });
  }, [status, serverUrl, token, reload]);

  const value: AuthState = {
    status,
    serverUrl,
    token,
    user,
    configureServer: async (url) => {
      await setServerUrl(url);
      await clearToken();
      setServerUrlState(url);
      setTokenState(null);
      setUser(null);
      invalidateClient();
      setStatus('unauthenticated');
    },
    signIn: async (username, password) => {
      if (!serverUrl) throw new Error('Server not configured');
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Invalid username or password');
      }
      const data = await res.json();
      await setToken(data.token);
      setTokenState(data.token);
      invalidateClient();
      setReload((r) => r + 1);
      setStatus('authenticated');
    },
    signOut: async () => {
      if (serverUrl && token) {
        fetch(`${serverUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      await clearToken();
      setTokenState(null);
      setUser(null);
      invalidateClient();
      setStatus('unauthenticated');
    },
    clearServer: async () => {
      await clearToken();
      await clearServerUrl();
      setServerUrlState(null);
      setTokenState(null);
      setUser(null);
      invalidateClient();
      setStatus('unconfigured');
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}
