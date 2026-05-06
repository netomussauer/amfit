import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { LoginRequestSchema, type LoginRequest, ROLES } from '@amfit/shared';
import { apiRequest, storeToken } from '@/shared/lib/api-client';
import type { AuthResponse } from '@amfit/shared';

export default function LoginScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: {
      email: '',
      senha: '',
      tipo: ROLES.ALUNO,
    },
  });

  async function handleLogin(values: LoginRequest) {
    setServerError(null);
    try {
      const data = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: values,
      });
      await storeToken(data.access_token);

      if (data.usuario.role === ROLES.PERSONAL) {
        router.replace('/(personal)/');
      } else {
        router.replace('/(aluno)/');
      }
    } catch {
      setServerError('E-mail ou senha inválidos.');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="mb-2 text-4xl font-bold text-primary">AMFIT</Text>
          <Text className="mb-8 text-sm text-gray-500">
            Acesse sua conta para continuar
          </Text>

          <View className="w-full space-y-4">
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">E-mail *</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                    placeholder="seu@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    accessibilityLabel="Campo de e-mail"
                  />
                )}
              />
              {errors.email && (
                <Text className="mt-1 text-xs text-red-500" accessibilityRole="alert">
                  {errors.email.message}
                </Text>
              )}
            </View>

            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700">Senha *</Text>
              <Controller
                control={control}
                name="senha"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    accessibilityLabel="Campo de senha"
                  />
                )}
              />
              {errors.senha && (
                <Text className="mt-1 text-xs text-red-500" accessibilityRole="alert">
                  {errors.senha.message}
                </Text>
              )}
            </View>

            {serverError && (
              <Text className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600" accessibilityRole="alert">
                {serverError}
              </Text>
            )}

            <TouchableOpacity
              className="mt-2 w-full items-center rounded-lg bg-primary py-3 disabled:opacity-50"
              onPress={handleSubmit(handleLogin)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              accessibilityState={{ busy: isSubmitting }}
            >
              <Text className="font-semibold text-white">
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
