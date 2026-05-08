import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { getCurrentUser, getDisplayName, type JwtPayload } from '@/shared/lib/auth';

function firstName(fullName: string | undefined): string {
  if (!fullName) return '';
  return fullName.split(' ')[0] ?? '';
}

export default function TreinoHojeScreen() {
  const [user, setUser] = useState<JwtPayload | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser);
  }, []);

  const greetingName = firstName(getDisplayName(user));

  return (
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="text-2xl font-bold text-gray-900">
        {greetingName ? `Olá, ${greetingName}` : 'Olá!'}
      </Text>
      <Text className="mt-1 text-sm text-gray-500">
        Aqui está o seu treino do dia.
      </Text>

      <View className="mt-8 items-center rounded-xl border border-gray-200 bg-gray-50 p-8">
        <Dumbbell color="#94a3b8" size={48} />
        <Text className="mt-4 text-base font-medium text-gray-700">
          Sem treino para hoje
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Quando seu personal liberar uma ficha, ela aparecerá aqui.
        </Text>
      </View>

      <TouchableOpacity
        className="mt-6 items-center rounded-lg bg-primary py-3 disabled:opacity-40"
        disabled
        accessibilityRole="button"
        accessibilityLabel="Iniciar treino"
        accessibilityState={{ disabled: true }}
      >
        <Text className="font-semibold text-white">Iniciar Treino</Text>
      </TouchableOpacity>
    </View>
  );
}
