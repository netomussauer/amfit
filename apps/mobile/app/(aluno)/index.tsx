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

function firstName(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.split(' ')[0] ?? '';
}

export default function TreinoHojeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<JwtPayload | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser);
  }, []);

  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTreinoHoje();

  const greetingName = firstName(getDisplayName(user));
  const treino = data?.treino ?? null;

  // 404 (sem ficha ativa) é tratado como estado vazio, não erro real.
  const isSemFicha = error instanceof ApiError && error.status === 404;
  const showError = isError && !isSemFicha;

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
          className="items-center rounded-lg bg-primary py-4 disabled:opacity-40"
          disabled
          accessibilityRole="button"
          accessibilityLabel="Iniciar Treino — em breve"
          accessibilityState={{ disabled: true }}
          accessibilityHint="Funcionalidade ainda não disponível"
        >
          <Text className="text-base font-semibold text-white">
            Iniciar Treino
          </Text>
          <Text className="mt-0.5 text-xs text-white/80">Em breve</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
