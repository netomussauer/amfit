import '../global.css';

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ROLES } from '@amfit/shared';
import { setAuthFailedHandler } from '@/shared/lib/api-client';
import { clearAll, getAccessToken, parseJwt } from '@/shared/lib/auth';
import { queryClient } from '@/shared/lib/query-client';
import {
  descartarTreinoHojeVencido,
  limparCache,
  normalizarQueriesRestauradas,
  persistOptions,
} from '@/shared/lib/query-persist';
import { configureOfflineSync } from '@/shared/lib/offline-sync';
import { encerrarBrandingAutenticado } from '@/features/tenant/lib/branding-session';
import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import { configurarNotificationHandler } from '@/features/notificacoes';

SplashScreen.preventAutoHideAsync();

// Em module scope (não num useEffect): precisa estar armado antes do
// primeiro render, senão uma mutation disparada logo na abertura do app
// corre antes do onlineManager saber se está offline.
configureOfflineSync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setAuthFailedHandler(() => {
      // Memória + disco juntos: sem apagar o cache em disco, o próximo
      // login neste aparelho veria treino/ficha da sessão que acabou de
      // cair, mesmo offline.
      void (async () => {
        // Cada passo é independente e best-effort: se um falhar (ex.:
        // SecureStore ao apagar tokens), os seguintes ainda rodam — senão a
        // marca do usuário que caiu ficaria no aparelho pro próximo a logar.
        const passos = [
          () => limparCache(queryClient),
          () => clearAll(),
          () => encerrarBrandingAutenticado(),
        ];
        for (const passo of passos) {
          try {
            await passo();
          } catch (err) {
            console.warn('[auth] falha ao limpar a sessão que expirou', err);
          }
        }
        router.replace('/(auth)/login');
      })();
    });

    return () => {
      setAuthFailedHandler(null);
    };
  }, [router]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getAccessToken();
        const inAuthGroup = segments[0] === '(auth)';

        if (!token) {
          // Já dentro do grupo (auth) (login, código de convite, deep link
          // amfit://entrar/<codigo>) não redireciona — senão o convite nunca
          // chegaria a rodar.
          if (!inAuthGroup) router.replace('/(auth)/login');
          return;
        }

        const payload = parseJwt(token);
        const role = payload?.role;

        const inAlunoGroup = segments[0] === '(aluno)';
        const inPersonalGroup = segments[0] === '(personal)';
        // Rotas compartilhadas pelo aluno fora do grupo (aluno) — ex.: player de treino.
        const inAlunoSharedRoute = segments[0] === 'treino';

        if (role === ROLES.ALUNO && !inAlunoGroup && !inAlunoSharedRoute) {
          router.replace('/(aluno)');
        } else if (role === ROLES.PERSONAL && !inPersonalGroup) {
          router.replace('/(personal)');
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
  useEffect(() => {
    // Roda uma vez por início de processo JS, independente de login — uma
    // sessão já autenticada que reabre o app cai direto no AuthGuard, sem
    // passar por useLogin/registrarPushTokenExpo, mas ainda precisa do
    // handler de foreground configurado pra notificações que chegarem.
    configurarNotificationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => {
          normalizarQueriesRestauradas(queryClient);
          descartarTreinoHojeVencido(queryClient);
        }}
      >
        <ThemeProvider>
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGuard>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
