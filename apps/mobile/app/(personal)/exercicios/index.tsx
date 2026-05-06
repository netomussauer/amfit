import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

export default function ExerciciosScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-900">Todos os exercícios</Text>
        <TouchableOpacity
          className="flex-row items-center gap-1 rounded-lg bg-primary px-3 py-2"
          onPress={() => router.push('/(personal)/exercicios/novo')}
          accessibilityRole="button"
          accessibilityLabel="Adicionar novo exercício"
        >
          <Plus color="#ffffff" size={16} />
          <Text className="text-sm font-medium text-white">Novo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={(item) => item}
        contentContainerStyle={{ padding: 24 }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">Nenhum exercício cadastrado.</Text>
            <Text className="mt-1 text-sm text-gray-400">
              Toque em "Novo" para adicionar um exercício.
            </Text>
          </View>
        }
        renderItem={() => null}
      />
    </View>
  );
}
