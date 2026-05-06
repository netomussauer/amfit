import { View, Text } from 'react-native';

export default function PersonalDashboardScreen() {
  return (
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
      <Text className="mt-2 text-sm text-gray-500">
        Visão geral dos seus alunos e sessões aparecerá aqui.
      </Text>
    </View>
  );
}
