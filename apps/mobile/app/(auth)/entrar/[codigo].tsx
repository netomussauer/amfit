import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAplicarCodigoTenant } from '@/features/tenant/hooks/useAplicarCodigoTenant';

// Deep link de convite: amfit://entrar/<codigo> (ADR-007, nível 2). Busca a
// marca do personal, guarda no aparelho e segue pro login já com ela.
export default function EntrarComCodigoScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const router = useRouter();
  const { aplicar, erro } = useAplicarCodigoTenant();

  // Uma tentativa por código: se `aplicar` mudar de identidade num re-render,
  // o efeito não pode disparar de novo e repetir a chamada (o endpoint
  // público tem limite por IP).
  const jaAplicado = useRef<string | null>(null);

  useEffect(() => {
    const alvo = typeof codigo === 'string' ? codigo : '';
    if (jaAplicado.current === alvo) return;
    jaAplicado.current = alvo;
    void aplicar(alvo);
  }, [codigo, aplicar]);

  if (!erro) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-sm text-gray-500">Validando convite...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-2 text-xl font-bold text-gray-900">Convite não encontrado</Text>
      <Text className="mb-6 text-center text-sm text-red-600" accessibilityRole="alert">
        {erro}
      </Text>
      <TouchableOpacity
        className="mb-3 w-full items-center rounded-lg bg-primary py-3"
        onPress={() => router.replace('/(auth)/codigo')}
        accessibilityRole="button"
        accessibilityLabel="Digitar o código"
      >
        <Text className="font-semibold text-white">Digitar o código</Text>
      </TouchableOpacity>
      <TouchableOpacity
        className="w-full items-center py-3"
        onPress={() => router.replace('/(auth)/login')}
        accessibilityRole="button"
        accessibilityLabel="Ir para o login"
      >
        <Text className="text-sm font-medium text-primary">Ir para o login</Text>
      </TouchableOpacity>
    </View>
  );
}
