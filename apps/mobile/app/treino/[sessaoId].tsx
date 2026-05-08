import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { TreinoResponse, RegistrarSerieRequest } from '@amfit/shared';
import { useSessao } from '@/features/execucao/hooks/useSessao';
import { useRegistrarSerie } from '@/features/execucao/hooks/useRegistrarSerie';
import { useConcluirSessao } from '@/features/execucao/hooks/useConcluirSessao';
import { useMinhaFicha } from '@/features/treino/hooks/useMinhaFicha';
import { ExercicioBlock } from '@/features/execucao/components/ExercicioBlock';
import { RestTimer } from '@/features/execucao/components/RestTimer';
import { ApiError } from '@/shared/lib/api-client';

const PERCENTUAL_MINIMO_CONCLUSAO = 0.5;

export default function PlayerScreen() {
  const { sessaoId: rawSessaoId } = useLocalSearchParams<{ sessaoId: string }>();
  const sessaoId = typeof rawSessaoId === 'string' ? rawSessaoId : '';
  const router = useRouter();

  const sessaoQuery = useSessao(sessaoId);
  const fichaQuery = useMinhaFicha();
  const registrarSerie = useRegistrarSerie(sessaoId);
  const concluirSessao = useConcluirSessao(sessaoId);

  const [restTimerSegundos, setRestTimerSegundos] = useState<number | null>(null);
  const [concluirError, setConcluirError] = useState<string | null>(null);

  const sessao = sessaoQuery.data;
  const ficha = fichaQuery.data;

  const treino: TreinoResponse | null = useMemo(() => {
    if (!sessao || !ficha) return null;
    return ficha.treinos.find((t) => t.id === sessao.treino_id) ?? null;
  }, [sessao, ficha]);

  const totalSeries = useMemo(() => {
    if (!treino) return 0;
    return treino.itens.reduce((acc, item) => acc + item.series, 0);
  }, [treino]);

  const seriesConcluidas = useMemo(() => {
    if (!sessao) return 0;
    return sessao.series.filter((s) => s.concluida).length;
  }, [sessao]);

  const progresso = totalSeries === 0 ? 0 : seriesConcluidas / totalSeries;
  const progressoSV = useSharedValue(0);

  useEffect(() => {
    progressoSV.value = withSpring(progresso, { damping: 14, stiffness: 110 });
  }, [progresso, progressoSV]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progressoSV.value * 100))}%`,
  }));

  function handleRegistrarSerie(input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) {
    const body: RegistrarSerieRequest = {
      item_treino_id: input.item_treino_id,
      numero_serie: input.numero_serie,
      concluida: input.concluida,
      carga_realizada: input.carga_realizada,
      repeticoes_realizadas: input.repeticoes_realizadas,
    };

    registrarSerie.mutate(body);

    if (input.concluida && treino) {
      const item = treino.itens.find((i) => i.id === input.item_treino_id);
      const descanso = item?.descanso_segundos;
      if (descanso && descanso > 0) {
        setRestTimerSegundos(descanso);
      }
    }
  }

  function handleConcluir() {
    if (progresso < PERCENTUAL_MINIMO_CONCLUSAO) return;

    Alert.alert(
      'Concluir treino',
      'Tem certeza? Séries não marcadas serão consideradas puladas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          style: 'default',
          onPress: () => {
            setConcluirError(null);
            concluirSessao.mutate(undefined, {
              onSuccess: () => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                router.replace(`/treino/concluido/${sessaoId}`);
              },
              onError: (err) => {
                if (err instanceof ApiError) {
                  setConcluirError(err.message || 'Não foi possível concluir.');
                } else {
                  setConcluirError('Erro inesperado ao concluir.');
                }
              },
            });
          },
        },
      ],
    );
  }

  function handleSair() {
    // Sai sem concluir — sessão fica EM_ANDAMENTO e pode ser retomada via "Continuar".
    router.back();
  }

  if (!sessaoId) {
    return (
      <ScreenError
        message="ID da sessão inválido."
        onBack={() => router.back()}
      />
    );
  }

  if (sessaoQuery.isLoading || fichaQuery.isLoading) {
    return <ScreenLoading />;
  }

  if (sessaoQuery.isError || fichaQuery.isError || !sessao) {
    return (
      <ScreenError
        message="Não foi possível carregar o treino."
        onBack={() => router.back()}
        onRetry={() => {
          void sessaoQuery.refetch();
          void fichaQuery.refetch();
        }}
      />
    );
  }

  if (!treino) {
    return (
      <ScreenError
        message="O treino desta sessão não foi encontrado na sua ficha ativa."
        onBack={() => router.back()}
      />
    );
  }

  const podeConcluir = progresso >= PERCENTUAL_MINIMO_CONCLUSAO;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header sticky */}
      <View className="border-b border-gray-200 bg-white px-4 pb-3 pt-12">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={handleSair}
            className="h-10 w-10 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Sair sem concluir o treino"
          >
            <X color="#0f172a" size={22} />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
              Treino {treino.letra}
              {treino.nome ? ` · ${treino.nome}` : ''}
            </Text>
            <Text className="text-xs text-gray-500">
              {seriesConcluidas} de {totalSeries} séries
            </Text>
          </View>
        </View>

        <View
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200"
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: totalSeries,
            now: seriesConcluidas,
          }}
        >
          <Animated.View
            style={progressBarStyle}
            className="h-1.5 rounded-full bg-primary"
          />
        </View>
      </View>

      {/* Body */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      >
        {treino.itens.map((item) => {
          const registros = sessao.series.filter(
            (s) => s.item_treino_id === item.id,
          );
          return (
            <ExercicioBlock
              key={item.id}
              item={item}
              registros={registros}
              onRegistrarSerie={handleRegistrarSerie}
            />
          );
        })}
      </ScrollView>

      {/* Footer sticky */}
      <View className="border-t border-gray-200 bg-white px-4 py-4">
        {concluirError && (
          <View
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
            accessibilityRole="alert"
          >
            <Text className="text-sm text-red-600">{concluirError}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={handleConcluir}
          disabled={!podeConcluir || concluirSessao.isPending}
          className={`items-center rounded-lg py-4 ${
            podeConcluir ? 'bg-primary' : 'bg-gray-300'
          } ${concluirSessao.isPending ? 'opacity-60' : ''}`}
          accessibilityRole="button"
          accessibilityLabel="Concluir treino"
          accessibilityState={{
            disabled: !podeConcluir || concluirSessao.isPending,
            busy: concluirSessao.isPending,
          }}
          accessibilityHint={
            podeConcluir
              ? undefined
              : `Marque pelo menos ${Math.ceil(totalSeries * PERCENTUAL_MINIMO_CONCLUSAO)} séries para concluir`
          }
        >
          <Text className="text-base font-semibold text-white">
            {concluirSessao.isPending ? 'Concluindo...' : 'Concluir Treino'}
          </Text>
          {!podeConcluir && (
            <Text className="mt-0.5 text-[11px] text-white/80">
              Marque ao menos {Math.ceil(totalSeries * PERCENTUAL_MINIMO_CONCLUSAO)} séries
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <RestTimer
        visible={restTimerSegundos !== null}
        duracaoSegundos={restTimerSegundos ?? 0}
        onComplete={() => setRestTimerSegundos(null)}
        onSkip={() => setRestTimerSegundos(null)}
      />
    </View>
  );
}

function ScreenLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color="#f97316" />
      <Text className="mt-2 text-sm text-gray-500">Carregando treino...</Text>
    </View>
  );
}

type ScreenErrorProps = {
  message: string;
  onBack: () => void;
  onRetry?: () => void;
};

function ScreenError({ message, onBack, onRetry }: ScreenErrorProps) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <AlertTriangle color="#dc2626" size={40} />
      <Text className="mt-3 text-center text-base font-medium text-red-700">
        {message}
      </Text>
      <View className="mt-4 flex-row gap-3">
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            className="rounded-lg bg-primary px-4 py-2"
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text className="text-sm font-medium text-white">Tentar novamente</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text className="text-sm font-medium text-gray-700">Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
