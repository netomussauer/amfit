import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import type { ExercicioResponse } from '@amfit/shared';

type Props = {
  exercicio: ExercicioResponse;
  onPress?: (exercicio: ExercicioResponse) => void;
};

export function ExercicioCard({ exercicio, onPress }: Props) {
  const isImage =
    exercicio.tipo_midia === 'IMAGEM' || exercicio.tipo_midia === 'GIF';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress?.(exercicio)}
      className="mb-3 flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
      accessibilityRole="button"
      accessibilityLabel={`Exercício ${exercicio.nome}`}
    >
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {exercicio.midia_url && isImage ? (
          <Image
            source={{ uri: exercicio.midia_url }}
            className="h-16 w-16"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Dumbbell color="#94a3b8" size={24} />
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-1 text-base font-semibold text-gray-900"
            numberOfLines={1}
          >
            {exercicio.nome}
          </Text>
          {exercicio.is_global && (
            <View className="rounded-full bg-primary/10 px-2 py-0.5">
              <Text className="text-[10px] font-semibold uppercase text-primary">
                Global
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
          {exercicio.grupo_muscular.nome}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
