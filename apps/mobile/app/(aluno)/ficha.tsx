import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import type { TreinoResponse } from '@amfit/shared';
import { ApiError } from '@/shared/lib/api-client';
import { useMinhaFicha } from '@/features/treino/hooks/useMinhaFicha';
import { ExercicioItem } from '@/features/treino/components/ExercicioItem';
import { EmptyTreinoState } from '@/features/treino/components/EmptyTreinoState';
import { TreinoSkeleton } from '@/features/treino/components/TreinoSkeleton';

export default function MinhaFichaScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, isRefetching, refetch } =
    useMinhaFicha();

  const isSemFicha = error instanceof ApiError && error.status === 404;
  const showError = isError && !isSemFicha;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-2 px-6 pt-12 pb-3 border-b border-gray-100">
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
          Minha ficha
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingVertical: 20,
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
        {isLoading ? (
          <TreinoSkeleton />
        ) : showError ? (
          <View
            className="items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10"
            accessibilityRole="alert"
          >
            <AlertTriangle color="#dc2626" size={40} />
            <Text className="mt-3 text-base font-medium text-red-700">
              Não foi possível carregar sua ficha
            </Text>
            <TouchableOpacity
              onPress={() => {
                void refetch();
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar ficha novamente"
            >
              <Text className="text-sm font-medium text-white">
                Tentar novamente
              </Text>
            </TouchableOpacity>
          </View>
        ) : isSemFicha || !data ? (
          <EmptyTreinoState
            title="Você ainda não tem ficha ativa"
            description="Aguarde seu personal liberar uma ficha para você."
          />
        ) : (
          <FichaConteudo
            nome={data.nome}
            vigenciaInicio={data.vigencia_inicio}
            vigenciaFim={data.vigencia_fim ?? null}
            treinos={data.treinos}
          />
        )}
      </ScrollView>
    </View>
  );
}

type FichaConteudoProps = {
  nome: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  treinos: TreinoResponse[];
};

function FichaConteudo({
  nome,
  vigenciaInicio,
  vigenciaFim,
  treinos,
}: FichaConteudoProps) {
  const treinosOrdenados = [...treinos].sort((a, b) => a.ordem - b.ordem);

  return (
    <View>
      <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <Text className="text-base font-semibold text-gray-900">{nome}</Text>
        <Text className="mt-1 text-xs text-gray-500">
          Início: {formatDate(vigenciaInicio)}
          {vigenciaFim ? ` • Fim: ${formatDate(vigenciaFim)}` : ' • Sem fim definido'}
        </Text>
        <Text className="mt-1 text-xs text-gray-500">
          {treinosOrdenados.length}{' '}
          {treinosOrdenados.length === 1 ? 'treino' : 'treinos'}
        </Text>
      </View>

      <View className="mt-4 gap-3">
        {treinosOrdenados.map((treino) => (
          <TreinoExpandivel key={treino.id} treino={treino} />
        ))}
      </View>
    </View>
  );
}

function TreinoExpandivel({ treino }: { treino: TreinoResponse }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center gap-3 px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={`Treino ${treino.letra}${treino.nome ? `, ${treino.nome}` : ''}, ${treino.itens.length} exercícios`}
        accessibilityState={{ expanded }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Text className="text-base font-bold text-white">
            {treino.letra}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            Treino {treino.letra}
          </Text>
          {treino.nome && (
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {treino.nome}
            </Text>
          )}
          <Text className="mt-0.5 text-xs text-gray-400">
            {treino.itens.length}{' '}
            {treino.itens.length === 1 ? 'exercício' : 'exercícios'}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp color="#94a3b8" size={20} />
        ) : (
          <ChevronDown color="#94a3b8" size={20} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View className="gap-2 border-t border-gray-100 bg-gray-50 px-3 py-3">
          {treino.itens.length === 0 ? (
            <Text className="py-4 text-center text-sm text-gray-500">
              Nenhum exercício neste treino.
            </Text>
          ) : (
            treino.itens
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((item) => <ExercicioItem key={item.id} item={item} />)
          )}
        </View>
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  // iso = YYYY-MM-DD — formatar como DD/MM/YYYY sem depender de Intl/timezones.
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
