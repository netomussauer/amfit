import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { getStoredToken } from '@/shared/lib/api-client';
import { ROLES, type AuthResponse } from '@amfit/shared';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function parseJwtPayload(token: string): { role?: string } | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { role?: string };
  } catch {
    return null;
  }
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getStoredToken();

        if (!token) {
          router.replace('/(auth)/login');
          return;
        }

        const payload = parseJwtPayload(token);
        const role = payload?.role;

        const inAuthGroup = segments[0] === '(auth)';
        const inAlunoGroup = segments[0] === '(aluno)';
        const inPersonalGroup = segments[0] === '(personal)';

        if (role === ROLES.ALUNO && !inAlunoGroup) {
          router.replace('/(aluno)/');
        } else if (role === ROLES.PERSONAL && !inPersonalGroup) {
          router.replace('/(personal)/');
        } else if (!role && !inAuthGroup) {
          router.replace('/(auth)/login');
        }
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    checkAuth();
  }, []);

  if (!isReady) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </QueryClientProvider>
  );
}
