import { ScrollView, Text, View } from 'react-native';
import type { EvolucaoCargaPoint } from '../lib/chart-data';
import { formatDataIso, formatNumero } from '../lib/chart-data';

type Props = {
  pontos: EvolucaoCargaPoint[];
};

const CHART_HEIGHT = 160;
const BAR_WIDTH = 28;

/**
 * Gráfico de barras simples (carga máxima por sessão) construído apenas
 * com Views nativas — sem dependência de bibliotecas de gráficos/SVG,
 * mantendo o app leve (filosofia de baixo consumo do projeto). A lista
 * abaixo do gráfico garante que a mesma informação fique acessível a
 * leitores de tela.
 */
export function EvolucaoCargaChart({ pontos }: Props) {
  const cargas = pontos
    .map((p) => p.cargaMaxima)
    .filter((v): v is number => v !== null);
  const maxCarga = cargas.length > 0 ? Math.max(...cargas) : 0;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'flex-end', gap: 12, paddingHorizontal: 4 }}
      >
        {pontos.map((ponto) => {
          const altura =
            maxCarga > 0 && ponto.cargaMaxima !== null
              ? Math.max(4, (ponto.cargaMaxima / maxCarga) * CHART_HEIGHT)
              : 4;

          return (
            <View key={ponto.sessaoId} className="items-center" style={{ width: BAR_WIDTH + 8 }}>
              <Text className="mb-1 text-[10px] font-medium text-gray-600" numberOfLines={1}>
                {ponto.cargaMaxima !== null ? formatNumero(ponto.cargaMaxima) : '—'}
              </Text>
              <View
                style={{ height: CHART_HEIGHT, width: BAR_WIDTH, justifyContent: 'flex-end' }}
              >
                <View
                  style={{ height: altura, width: BAR_WIDTH }}
                  className={
                    ponto.cargaMaxima !== null ? 'rounded-t-md bg-primary' : 'rounded-t-md bg-gray-200'
                  }
                />
              </View>
              <Text className="mt-1 text-[10px] text-gray-500">{formatDataIso(ponto.data)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
