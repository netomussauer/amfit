import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { ROLES } from '@amfit/shared';
import { setAuthFailedHandler } from '@/shared/lib/api-client';
import { clearAll, getAccessToken, parseJwt } from '@/shared/lib/auth';

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setAuthFailedHandler(() => {
      void clearAll().finally(() => {
        queryClient.clear();
        router.replace('/(auth)/login');
      });
    });

    return () => {
      setAuthFailedHandler(null);
    };
  }, [router]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getAccessToken();

        if (!token) {
          router.replace('/(auth)/login');
          return;
        }

        const payload = parseJwt(token);
        const role = payload?.role;

        const inAuthGroup = segments[0] === '(auth)';
        const inAlunoGroup = segments[0] === '(aluno)';
        const inPersonalGroup = segments[0] === '(personal)';
        // Rotas compartilhadas pelo aluno fora do grupo (aluno) — ex.: player de treino.
        const inAlunoSharedRoute = segments[0] === 'treino';

        if (role === ROLES.ALUNO && !inAlunoGroup && !inAlunoSharedRoute) {
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
    // segments precisa estar aqui: sem isso, o guard só roda 1x no mount e
    // nunca revalida o perfil em navegações seguintes (achado do eslint
    // react-hooks/exhaustive-deps ao configurar lint pela primeira vez
    // neste app) — diferente do middleware do web, que já revalida a cada
    // navegação. router é estável entre renders (expo-router), incluí-lo
    // aqui não muda o comportamento, só satisfaz a regra.
  }, [router, segments]);

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
