import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { getCurrentUser, getDisplayName, type JwtPayload } from '@/shared/lib/auth';

export default function PersonalPerfilScreen() {
  const { mutate: doLogout, isPending: isLoggingOut } = useLogout();
  const [user, setUser] = useState<JwtPayload | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser);
  }, []);

  function handleLogout() {
    doLogout();
  }

  return (
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="text-2xl font-bold text-gray-900">Perfil</Text>
      <Text className="mt-1 text-sm text-gray-500">
        Sua conta de personal trainer.
      </Text>

      {getDisplayName(user) && (
        <View className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-lg font-semibold text-gray-900">{getDisplayName(user)}</Text>
          <Text className="mt-1 text-sm text-gray-500">Personal Trainer</Text>
        </View>
      )}

      <View className="mt-auto">
        <TouchableOpacity
          className="items-center rounded-lg border border-red-200 bg-red-50 py-3 disabled:opacity-50"
          onPress={handleLogout}
          disabled={isLoggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          accessibilityState={{ busy: isLoggingOut, disabled: isLoggingOut }}
        >
          <Text className="font-medium text-red-600">
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
