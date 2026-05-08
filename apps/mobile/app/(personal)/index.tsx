import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Dumbbell, ChevronRight } from 'lucide-react-native';
import { useExercicios } from '@/features/exercicios/hooks/useExercicios';

export default function PersonalDashboardScreen() {
  const router = useRouter();
  const { data, isLoading } = useExercicios({});

  const total = data?.data.length ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}
    >
      <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
      <Text className="mt-2 text-sm text-gray-500">
        Visão geral dos seus alunos e sessões aparecerá aqui.
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(personal)/exercicios')}
        className="mt-6 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
        accessibilityRole="button"
        accessibilityLabel="Ver exercícios"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Dumbbell color="#f97316" size={20} />
          </View>
          <View>
            <Text className="text-base font-semibold text-gray-900">
              Exercícios
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500">
              {isLoading
                ? 'Carregando...'
                : `${total} ${total === 1 ? 'exercício' : 'exercícios'} cadastrados`}
            </Text>
          </View>
        </View>
        <ChevronRight color="#94a3b8" size={18} />
      </TouchableOpacity>
    </ScrollView>
  );
}
