import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, TrendingUp } from 'lucide-react-native';
import { calcularDataInicio, type ExercicioResponse } from '@amfit/shared';
import { ApiError } from '@/shared/lib/api-client';
import { useMinhaFicha } from '@/features/treino/hooks/useMinhaFicha';
import { useMeuProgresso } from '@/features/progresso/hooks/useMeuProgresso';
import { EvolucaoCargaChart } from '@/features/progresso/components/EvolucaoCargaChart';
import {
  buildEvolucaoCarga,
  formatDataIso,
  formatNumero,
} from '@/features/progresso/lib/chart-data';

type Params = {
  exercicioId?: string;
  nome?: string;
};

export default function ProgressoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();

  // useLocalSearchParams pode devolver string[] quando o segmento de rota
  // repete a chave — normalizamos para string única (ou undefined).
  const initialExercicioId =
    typeof params.exercicioId === 'string' ? params.exercicioId : undefined;
  const initialNome = typeof params.nome === 'string' ? params.nome : undefined;

  const [exercicioId, setExercicioId] = useState<string | undefined>(
    initialExercicioId,
  );
  const [exercicioNome, setExercicioNome] = useState<string | undefined>(
    initialNome,
  );

  // A tab `progresso` fica montada entre navegações (href: null, mesmo
  // padrão de `ficha`), então o useState inicial acima só roda uma vez.
  // Sem este efeito, reabrir a tela com um exercicioId diferente (ou
  // nenhum) a partir de Ficha/Histórico mantém o exercício anterior na
  // tela em vez de refletir os novos params de navegação.
  useEffect(() => {
    setExercicioId(initialExercicioId);
    setExercicioNome(initialNome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExercicioId, initialNome]);

  function handleSelecionar(exercicio: ExercicioResponse) {
    setExercicioId(exercicio.id);
    setExercicioNome(exercicio.nome);
  }

  function handleTrocarExercicio() {
    setExercicioId(undefined);
    setExercicioNome(undefined);
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-2 border-b border-gray-100 px-6 pb-3 pt-12">
        <TouchableOpacity
          onPress={() => router.back()}
          className="-ml-2 h-9 w-9 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
        >
          <ArrowLeft color="#0f172a" size={22} />
        </TouchableOpacity>
        <Text
          className="text-lg font-semibold text-gray-900"
          accessibilityRole="header"
        >
          Evolução de carga
        </Text>
      </View>

      {exercicioId ? (
        <EvolucaoConteudo
          exercicioId={exercicioId}
          exercicioNome={exercicioNome}
          onTrocarExercicio={handleTrocarExercicio}
        />
      ) : (
        <SeletorExercicio onSelecionar={handleSelecionar} />
      )}
    </View>
  );
}

type SeletorProps = {
  onSelecionar: (exercicio: ExercicioResponse) => void;
};

function SeletorExercicio({ onSelecionar }: SeletorProps) {
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useMinhaFicha();

  const isSemFicha = error instanceof ApiError && error.status === 404;
  const showError = isError && !isSemFicha;

  const exercicios = useMemo(() => {
    if (!data) return [];
    const mapa = new Map<string, ExercicioResponse>();
    for (const treino of data.treinos) {
      for (const item of treino.itens) {
        mapa.set(item.exercicio.id, item.exercicio);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, flexGrow: 1 }}
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
      <Text className="text-sm text-gray-500">
        Selecione um exercício para ver sua evolução de carga ao longo do tempo.
      </Text>

      <View className="mt-4 gap-2">
        {isLoading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 24 }} />
        ) : showError ? (
          <View
            className="items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10"
            accessibilityRole="alert"
          >
            <AlertTriangle color="#dc2626" size={40} />
            <Text className="mt-3 text-base font-medium text-red-700">
              Não foi possível carregar seus exercícios
            </Text>
            <TouchableOpacity
              onPress={() => {
                void refetch();
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-sm font-medium text-white">Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : isSemFicha || exercicios.length === 0 ? (
          <View className="mt-10 items-center rounded-xl border border-dashed border-gray-200 px-6 py-10">
            <TrendingUp color="#94a3b8" size={40} />
            <Text className="mt-3 text-base font-medium text-gray-700">
              Nenhum exercício disponível
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Assim que você tiver uma ficha ativa, seus exercícios aparecerão aqui.
            </Text>
          </View>
        ) : (
          exercicios.map((exercicio) => (
            <TouchableOpacity
              key={exercicio.id}
              onPress={() => onSelecionar(exercicio)}
              activeOpacity={0.7}
              className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel={`Ver evolução de ${exercicio.nome}`}
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                  {exercicio.nome}
                </Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  {exercicio.grupo_muscular.nome}
                </Text>
              </View>
              <TrendingUp color="#f97316" size={18} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

type EvolucaoProps = {
  exercicioId: string;
  exercicioNome?: string;
  onTrocarExercicio: () => void;
};

function EvolucaoConteudo({
  exercicioId,
  exercicioNome,
  onTrocarExercicio,
}: EvolucaoProps) {
  // Limita a 180 dias por padrão: o backend por si só já janela em 12
  // meses/500 pontos, mas isso ainda pode ser bastante payload/render num
  // aparelho mobile para quem treina o mesmo exercício há muito tempo.
  const params = useMemo(() => ({ from: calcularDataInicio(180) }), []);
  const { data, isLoading, isError, isRefetching, refetch } = useMeuProgresso(
    exercicioId,
    params,
  );

  const evolucao = useMemo(
    () => buildEvolucaoCarga(data?.pontos ?? []),
    [data],
  );

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, flexGrow: 1 }}
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
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-xl font-bold text-gray-900" numberOfLines={2}>
          {exercicioNome ?? 'Exercício'}
        </Text>
        <TouchableOpacity
          onPress={onTrocarExercicio}
          accessibilityRole="button"
          accessibilityLabel="Trocar exercício"
        >
          <Text className="text-sm font-medium text-primary">Trocar</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4">
        {isLoading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 24 }} />
        ) : isError ? (
          <View
            className="items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10"
            accessibilityRole="alert"
          >
            <AlertTriangle color="#dc2626" size={40} />
            <Text className="mt-3 text-base font-medium text-red-700">
              Não foi possível carregar seu histórico
            </Text>
            <TouchableOpacity
              onPress={() => {
                void refetch();
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-sm font-medium text-white">Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : evolucao.length === 0 ? (
          <View className="mt-6 items-center rounded-xl border border-dashed border-gray-200 px-6 py-10">
            <TrendingUp color="#94a3b8" size={40} />
            <Text className="mt-3 text-base font-medium text-gray-700">
              Sem registros ainda
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Assim que você concluir séries deste exercício, a evolução aparece aqui.
            </Text>
          </View>
        ) : (
          <>
            <EvolucaoCargaChart pontos={evolucao} />

            <View className="mt-4 gap-2">
              {evolucao
                .slice()
                .reverse()
                .map((ponto) => (
                  <View
                    key={ponto.sessaoId}
                    className="flex-row items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    accessibilityLabel={`Sessão de ${formatDataIso(ponto.data)}: carga máxima ${
                      ponto.cargaMaxima !== null
                        ? `${formatNumero(ponto.cargaMaxima)} quilos`
                        : 'não registrada'
                    }`}
                  >
                    <Text className="text-sm text-gray-700">
                      {formatDataIso(ponto.data)}
                    </Text>
                    <Text className="text-sm font-semibold text-gray-900">
                      {ponto.cargaMaxima !== null
                        ? `${formatNumero(ponto.cargaMaxima)} kg`
                        : '—'}
                    </Text>
                  </View>
                ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
