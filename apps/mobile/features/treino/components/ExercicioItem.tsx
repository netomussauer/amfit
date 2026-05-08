import { View, Text, Image } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import type { ItemTreinoResponse } from '@amfit/shared';

type Props = {
  item: ItemTreinoResponse;
};

function formatCarga(carga: number | null | undefined): string | null {
  if (carga === null || carga === undefined) return null;
  // Remove trailing zeros (ex.: 12.5 -> "12,5"; 10 -> "10")
  const formatted = Number.isInteger(carga)
    ? String(carga)
    : carga.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} kg`;
}

export function ExercicioItem({ item }: Props) {
  const { exercicio } = item;
  const isImage =
    exercicio.tipo_midia === 'IMAGEM' || exercicio.tipo_midia === 'GIF';
  const carga = formatCarga(item.carga_sugerida);

  return (
    <View
      className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
      accessibilityRole="text"
      accessibilityLabel={`Exercício ${exercicio.nome}, ${item.series} séries de ${item.repeticoes} repetições${carga ? `, carga sugerida ${carga}` : ''}`}
    >
      <View className="h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {exercicio.midia_url && isImage ? (
          <Image
            source={{ uri: exercicio.midia_url }}
            className="h-[60px] w-[60px]"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Dumbbell color="#94a3b8" size={24} />
        )}
      </View>

      <View className="flex-1">
        <Text
          className="text-base font-semibold text-gray-900"
          numberOfLines={1}
        >
          {exercicio.nome}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
          {exercicio.grupo_muscular.nome}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-sm font-medium text-gray-700">
            {item.series}×{item.repeticoes}
          </Text>
          {carga && (
            <>
              <Text className="text-xs text-gray-400">•</Text>
              <Text className="text-sm text-gray-600">{carga}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
