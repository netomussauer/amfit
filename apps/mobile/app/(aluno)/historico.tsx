import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, History as HistoryIcon, TrendingUp } from 'lucide-react-native';
import type { SessaoResumoResponse } from '@amfit/shared';
import { SESSAO_STATUS } from '@amfit/shared';
import { useMinhasSessoes } from '@/features/execucao/hooks/useMinhasSessoes';

function formatData(iso: string): string {
  // Espera "YYYY-MM-DD" — converte para dd/mm/yyyy sem depender de locale.
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function statusLabel(status: SessaoResumoResponse['status']): string {
  switch (status) {
    case SESSAO_STATUS.CONCLUIDO:
      return 'Concluído';
    case SESSAO_STATUS.EM_ANDAMENTO:
      return 'Em andamento';
    case SESSAO_STATUS.ABANDONADO:
      return 'Abandonado';
    default:
      return status;
  }
}

function statusColors(status: SessaoResumoResponse['status']) {
  switch (status) {
    case SESSAO_STATUS.CONCLUIDO:
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case SESSAO_STATUS.EM_ANDAMENTO:
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

export default function HistoricoScreen() {
  const router = useRouter();
  const [page] = useState(1);
  const { data, isLoading, isError, isRefetching, refetch } = useMinhasSessoes(page);

  const sessoes = data?.data ?? [];

  function handlePressItem(sessao: SessaoResumoResponse) {
    Alert.alert(
      'Detalhe da sessão',
      `Detalhamento de "${sessao.treino_letra}${sessao.treino_nome ? ` · ${sessao.treino_nome}` : ''}" estará disponível em breve.`,
      [{ text: 'OK' }],
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#f97316" />
        <Text className="mt-2 text-sm text-gray-500">Carregando histórico...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
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
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      data={sessoes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 32,
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <View className="mb-4">
          <Text
            className="text-2xl font-bold text-gray-900"
            accessibilityRole="header"
          >
            Histórico
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            Todos os treinos que você já registrou.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(aluno)/progresso')}
            className="mt-3 flex-row items-center self-start gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5"
            accessibilityRole="button"
            accessibilityLabel="Ver evolução de carga por exercício"
          >
            <TrendingUp color="#f97316" size={16} />
            <Text className="text-sm font-medium text-primary">
              Ver evolução por exercício
            </Text>
          </TouchableOpacity>
        </View>
      }
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListEmptyComponent={
        <View className="mt-10 items-center rounded-xl border border-dashed border-gray-200 px-6 py-10">
          <HistoryIcon color="#94a3b8" size={40} />
          <Text className="mt-3 text-base font-medium text-gray-700">
            Nenhum treino ainda
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            Seu histórico aparecerá aqui após o primeiro treino concluído.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
          tintColor="#f97316"
        />
      }
      renderItem={({ item }) => (
        <SessaoListItem item={item} onPress={() => handlePressItem(item)} />
      )}
    />
  );
}

type SessaoListItemProps = {
  item: SessaoResumoResponse;
  onPress: () => void;
};

function SessaoListItem({ item, onPress }: SessaoListItemProps) {
  const colors = statusColors(item.status);
  const total = item.total_series;
  const feitas = item.series_concluidas;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
      accessibilityRole="button"
      accessibilityLabel={`Sessão de ${formatData(item.data_execucao)}, treino ${item.treino_letra}, status ${statusLabel(item.status)}, ${feitas} de ${total} séries`}
    >
      <View className="h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Text className="text-lg font-bold text-primary">{item.treino_letra}</Text>
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
          {item.treino_nome ?? `Treino ${item.treino_letra}`}
        </Text>
        <Text className="text-xs text-gray-500">{formatData(item.data_execucao)}</Text>
        <Text className="mt-0.5 text-xs text-gray-500">
          {feitas}/{total} séries
        </Text>
      </View>

      <View
        className={`rounded-full border px-2 py-0.5 ${colors.bg} ${colors.border}`}
      >
        <Text className={`text-[11px] font-semibold ${colors.text}`}>
          {statusLabel(item.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
