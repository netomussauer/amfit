import { ScrollView, TouchableOpacity, Text, View } from 'react-native';
import type { GrupoMuscular } from '@amfit/shared';

type Props = {
  grupos: GrupoMuscular[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading?: boolean;
};

export function GrupoChips({ grupos, selectedId, onSelect, isLoading }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
      className="max-h-12"
    >
      <Chip
        label="Todos"
        active={selectedId === null}
        onPress={() => onSelect(null)}
      />
      {isLoading ? (
        <View className="rounded-full bg-gray-100 px-3 py-1.5">
          <Text className="text-xs text-gray-400">Carregando...</Text>
        </View>
      ) : (
        grupos.map((grupo) => (
          <Chip
            key={grupo.id}
            label={grupo.nome}
            active={selectedId === grupo.id}
            onPress={() => onSelect(grupo.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`rounded-full px-3 py-1.5 ${
        active ? 'bg-primary' : 'bg-gray-100'
      }`}
      accessibilityRole="button"
      accessibilityLabel={`Filtrar por ${label}`}
      accessibilityState={{ selected: active }}
    >
      <Text
        className={`text-xs font-medium ${
          active ? 'text-white' : 'text-gray-700'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
