import { View, Text, TouchableOpacity } from 'react-native';
import { removeToken } from '@/shared/lib/api-client';
import { useRouter } from 'expo-router';

export default function PersonalPerfilScreen() {
  const router = useRouter();

  async function handleLogout() {
    await removeToken();
    router.replace('/(auth)/login');
  }

  return (
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="text-2xl font-bold text-gray-900">Perfil</Text>
      <Text className="mt-2 text-sm text-gray-500">
        Suas informações de perfil aparecerão aqui.
      </Text>

      <TouchableOpacity
        className="mt-8 items-center rounded-lg border border-red-200 bg-red-50 py-3"
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Text className="font-medium text-red-600">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
