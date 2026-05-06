import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { CriarExercicioRequestSchema, type CriarExercicioRequest } from '@amfit/shared';

export default function NovoExercicioScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CriarExercicioRequest>({
    resolver: zodResolver(CriarExercicioRequestSchema),
    defaultValues: {
      nome: '',
      grupo_muscular_id: '',
      descricao: '',
    },
  });

  async function handleSalvar(values: CriarExercicioRequest) {
    // Mutation para criar exercício será implementada com TanStack Query
    console.log('Criar exercício:', values);
    router.back();
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
        <View className="px-6 py-6 space-y-4">
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">Nome *</Text>
            <Controller
              control={control}
              name="nome"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                  placeholder="Ex: Supino Reto com Barra"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  accessibilityLabel="Nome do exercício"
                />
              )}
            />
            {errors.nome && (
              <Text className="mt-1 text-xs text-red-500" accessibilityRole="alert">
                {errors.nome.message}
              </Text>
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">Grupo muscular *</Text>
            <Controller
              control={control}
              name="grupo_muscular_id"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                  placeholder="ID do grupo muscular"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  accessibilityLabel="Grupo muscular"
                />
              )}
            />
            {errors.grupo_muscular_id && (
              <Text className="mt-1 text-xs text-red-500" accessibilityRole="alert">
                {errors.grupo_muscular_id.message}
              </Text>
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">Descrição</Text>
            <Controller
              control={control}
              name="descricao"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                  placeholder="Descreva a execução do exercício..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  accessibilityLabel="Descrição do exercício"
                />
              )}
            />
          </View>

          <TouchableOpacity
            className="mt-4 items-center rounded-lg bg-primary py-3 disabled:opacity-50"
            onPress={handleSubmit(handleSalvar)}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Salvar exercício"
            accessibilityState={{ busy: isSubmitting }}
          >
            <Text className="font-semibold text-white">
              {isSubmitting ? 'Salvando...' : 'Salvar Exercício'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
