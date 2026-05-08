import { View, Text } from 'react-native';
import { CalendarOff } from 'lucide-react-native';

type Props = {
  title?: string;
  description?: string;
};

export function EmptyTreinoState({
  title = 'Nenhum treino agendado',
  description = 'Quando seu personal liberar uma ficha, ela aparecerá aqui.',
}: Props) {
  return (
    <View
      className="items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10"
      accessibilityRole="summary"
    >
      <CalendarOff color="#94a3b8" size={44} />
      <Text className="mt-4 text-base font-medium text-gray-700">{title}</Text>
      <Text className="mt-1 text-center text-sm text-gray-500">
        {description}
      </Text>
    </View>
  );
}
