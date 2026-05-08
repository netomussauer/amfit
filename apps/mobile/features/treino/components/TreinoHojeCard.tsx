import { View, Text } from 'react-native';
import type { TreinoResponse } from '@amfit/shared';
import { ExercicioItem } from './ExercicioItem';

type Props = {
  treino: TreinoResponse;
};

export function TreinoHojeCard({ treino }: Props) {
  return (
    <View
      className="rounded-xl border border-gray-200 bg-white p-4"
      accessibilityLabel={`Treino ${treino.letra}${treino.nome ? `, ${treino.nome}` : ''}, ${treino.itens.length} exercícios`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-lg bg-primary"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Text className="text-xl font-bold text-white">{treino.letra}</Text>
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
      </View>

      <View className="mt-4 gap-2">
        {treino.itens.map((item) => (
          <ExercicioItem key={item.id} item={item} />
        ))}
      </View>
    </View>
  );
}
