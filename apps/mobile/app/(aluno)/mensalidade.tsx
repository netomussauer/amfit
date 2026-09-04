import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, Wallet } from 'lucide-react-native';
import { ApiError } from '@/shared/lib/api-client';
import { useMeuPlano } from '@/features/financeiro/hooks/useMeuPlano';
import { useMinhasMensalidades } from '@/features/financeiro/hooks/useMinhasMensalidades';

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  ATRASADA: 'Atrasada',
  CANCELADA: 'Cancelada',
  ISENTA: 'Isenta',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDENTE: { bg: 'bg-gray-100', text: 'text-gray-600' },
  PAGA: { bg: 'bg-green-50', text: 'text-green-700' },
  ATRASADA: { bg: 'bg-red-50', text: 'text-red-700' },
  CANCELADA: { bg: 'bg-gray-100', text: 'text-gray-600' },
  ISENTA: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCompetencia(ano: number, mes: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

export default function MensalidadeScreen() {
  const router = useRouter();

  const plano = useMeuPlano();
  const mensalidades = useMinhasMensalidades({ per_page: 12 });

  const semPlano = plano.error instanceof ApiError && plano.error.status === 404;
  const showPlanoError = plano.isError && !semPlano;

  const refreshing = plano.isRefetching || mensalidades.isRefetching;
  const isLoading = plano.isLoading || mensalidades.isLoading;

  function handleRefresh() {
    void plano.refetch();
    void mensalidades.refetch();
  }

  const lista = useMemo(() => mensalidades.data?.data ?? [], [mensalidades.data]);

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
        <Text className="text-lg font-semibold text-gray-900" accessibilityRole="header">
          Minha mensalidade
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#f97316" />
        }
      >
        {isLoading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 24 }} />
        ) : showPlanoError ? (
          <View
            className="items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10"
            accessibilityRole="alert"
          >
            <AlertTriangle color="#dc2626" size={40} />
            <Text className="mt-3 text-base font-medium text-red-700">
              Não foi possível carregar sua mensalidade
            </Text>
            <TouchableOpacity
              onPress={() => {
                void plano.refetch();
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-sm font-medium text-white">Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : semPlano ? (
          <View className="mt-10 items-center rounded-xl border border-dashed border-gray-200 px-6 py-10">
            <Wallet color="#94a3b8" size={40} />
            <Text className="mt-3 text-base font-medium text-gray-700">
              Nenhum plano configurado ainda
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Fale com seu personal para configurar seu plano de mensalidade.
            </Text>
          </View>
        ) : (
          plano.data && (
            <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <Text className="text-2xl font-bold text-gray-900">
                {formatBRL(plano.data.valor_mensal)}
                <Text className="text-sm font-normal text-gray-500">/mês</Text>
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                Vencimento todo dia {plano.data.dia_vencimento}
              </Text>
            </View>
          )
        )}

        {!isLoading && lista.length > 0 && (
          <View className="mt-6 gap-2">
            <Text className="text-sm font-semibold text-gray-900">Mensalidades recentes</Text>
            {lista.map((m) => {
              const cor = STATUS_COLOR[m.status] ?? STATUS_COLOR.PENDENTE;
              return (
                <View
                  key={m.id}
                  className="flex-row items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-3"
                >
                  <View>
                    <Text className="text-sm font-medium text-gray-900">
                      {formatCompetencia(m.competencia_ano, m.competencia_mes)}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {formatBRL(m.valor_pago ?? m.valor)}
                    </Text>
                  </View>
                  <View className={`rounded-full px-2 py-1 ${cor.bg}`}>
                    <Text className={`text-xs font-medium ${cor.text}`}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
