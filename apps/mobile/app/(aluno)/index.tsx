import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import { ApiError } from '@/shared/lib/api-client';
import { getCurrentUser, getDisplayName, type JwtPayload } from '@/shared/lib/auth';
import { useTreinoHoje } from '@/features/treino/hooks/useTreinoHoje';
import { TreinoHojeCard } from '@/features/treino/components/TreinoHojeCard';
import { EmptyTreinoState } from '@/features/treino/components/EmptyTreinoState';
import { TreinoSkeleton } from '@/features/treino/components/TreinoSkeleton';
import { useIniciarSessao } from '@/features/execucao/hooks/useIniciarSessao';

function firstName(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.split(' ')[0] ?? '';
}

export default function TreinoHojeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [iniciarError, setIniciarError] = useState<string | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser);
  }, []);

  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTreinoHoje();
  const iniciarMutation = useIniciarSessao();

  const greetingName = firstName(getDisplayName(user));
  const treino = data?.treino ?? null;
  const sessaoHojeId = data?.sessao_hoje_id ?? null;

  // 404 (sem ficha ativa) é tratado como estado vazio, não erro real.
  const isSemFicha = error instanceof ApiError && error.status === 404;
  const showError = isError && !isSemFicha;

  async function handleIniciar() {
    if (!treino) return;
    setIniciarError(null);
    try {
      const sessao = await iniciarMutation.mutateAsync({ treino_id: treino.id });
      router.push(`/treino/${sessao.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setIniciarError(err.message || 'Não foi possível iniciar o treino.');
      } else {
        setIniciarError('Erro inesperado ao iniciar o treino.');
      }
    }
  }

  function handleContinuar() {
    if (!sessaoHojeId) return;
    router.push(`/treino/${sessaoHojeId}`);
  }

  const podeIniciar = treino !== null && !iniciarMutation.isPending;
  const continuarMode = sessaoHojeId !== null;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 32,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
          tintColor="#f97316"
        />
      }
    >
      <Text
        className="text-2xl font-bold text-gray-900"
        accessibilityRole="header"
      >
        {greetingName ? `Olá, ${greetingName}` : 'Olá!'}
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        Aqui está o seu treino do dia.
      </Text>

      <TouchableOpacity
        className="mt-4 flex-row items-center self-start"
        onPress={() => router.push('/(aluno)/ficha')}
        accessibilityRole="link"
        accessibilityLabel="Ver ficha completa"
      >
        <Text className="text-sm font-medium text-primary">
          Ver ficha completa
        </Text>
        <ChevronRight color="#f97316" size={16} />
      </TouchableOpacity>

      <View className="mt-6">
        {isLoading ? (
          <TreinoSkeleton />
        ) : showError ? (
          <View
            className="items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10"
            accessibilityRole="alert"
          >
            <AlertTriangle color="#dc2626" size={40} />
            <Text className="mt-3 text-base font-medium text-red-700">
              Não foi possível carregar seu treino
            </Text>
            <Text className="mt-1 text-center text-sm text-red-600">
              Verifique sua conexão e tente novamente.
            </Text>
            <TouchableOpacity
              onPress={() => {
                void refetch();
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar treino novamente"
            >
              <Text className="text-sm font-medium text-white">
                Tentar novamente
              </Text>
            </TouchableOpacity>
          </View>
        ) : treino ? (
          <TreinoHojeCard treino={treino} />
        ) : (
          <EmptyTreinoState />
        )}
      </View>

      <View className="mt-8">
        <TouchableOpacity
          className={`items-center rounded-lg bg-primary py-4 ${
            podeIniciar ? '' : 'opacity-40'
          }`}
          disabled={!podeIniciar}
          onPress={continuarMode ? handleContinuar : handleIniciar}
          accessibilityRole="button"
          accessibilityLabel={
            continuarMode ? 'Continuar treino em andamento' : 'Iniciar treino'
          }
          accessibilityState={{
            disabled: !podeIniciar,
            busy: iniciarMutation.isPending,
          }}
        >
          <Text className="text-base font-semibold text-white">
            {iniciarMutation.isPending
              ? 'Iniciando...'
              : continuarMode
                ? 'Continuar Treino'
                : 'Iniciar Treino'}
          </Text>
          {continuarMode && (
            <Text className="mt-0.5 text-xs text-white/80">
              Você tem uma sessão em andamento
            </Text>
          )}
        </TouchableOpacity>

        {iniciarError && (
          <View
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
            accessibilityRole="alert"
          >
            <Text className="text-sm text-red-600">{iniciarError}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
