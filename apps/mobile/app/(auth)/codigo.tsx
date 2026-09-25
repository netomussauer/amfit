import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAplicarCodigoTenant } from '@/features/tenant/hooks/useAplicarCodigoTenant';

// Alternativa ao deep link: o aluno digita o código de convite que o
// personal enviou (ADR-007, nível 2).
export default function CodigoScreen() {
  const router = useRouter();
  const [valor, setValor] = useState('');
  const { aplicar, carregando, erro, limparErro } = useAplicarCodigoTenant();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="mb-2 text-2xl font-bold text-gray-900" accessibilityRole="header">
            Código do seu personal
          </Text>
          <Text className="mb-8 text-center text-sm text-gray-500">
            Digite o código de convite que ele enviou para ver a marca dele no aplicativo.
          </Text>

          <View className="w-full space-y-4">
            <TextInput
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-xl font-semibold tracking-widest text-gray-900"
              placeholder="K7M2QX9P"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              value={valor}
              onChangeText={(texto) => {
                if (erro) limparErro();
                setValor(texto);
              }}
              onSubmitEditing={() => void aplicar(valor)}
              accessibilityLabel="Campo do código de convite"
            />

            {erro && (
              <Text
                className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600"
                accessibilityRole="alert"
              >
                {erro}
              </Text>
            )}

            <TouchableOpacity
              className="w-full items-center rounded-lg bg-primary py-3 disabled:opacity-50"
              onPress={() => void aplicar(valor)}
              disabled={carregando || valor.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Continuar"
              accessibilityState={{
                busy: carregando,
                disabled: carregando || valor.trim().length === 0,
              }}
            >
              <Text className="font-semibold text-white">
                {carregando ? 'Validando...' : 'Continuar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="items-center py-2"
              onPress={() => router.replace('/(auth)/login')}
              accessibilityRole="link"
              accessibilityLabel="Voltar ao login"
            >
              <Text className="text-sm font-medium text-primary">Voltar ao login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
