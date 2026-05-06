import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function TreinoHojeScreen() {
  const router = useRouter();

  function handleIniciarTreino() {
    // Navegação para a sessão de treino será implementada
  }

  return (
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="text-2xl font-bold text-gray-900">Treino de hoje</Text>
      <Text className="mt-2 text-sm text-gray-500">
        Seu treino do dia aparecerá aqui quando sua ficha estiver ativa.
      </Text>

      <View className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <Text className="text-center text-gray-500">Nenhum treino agendado</Text>
      </View>

      <TouchableOpacity
        className="mt-6 items-center rounded-lg bg-primary py-3"
        onPress={handleIniciarTreino}
        accessibilityRole="button"
        accessibilityLabel="Iniciar treino"
      >
        <Text className="font-semibold text-white">Iniciar Treino</Text>
      </TouchableOpacity>
    </View>
  );
}
