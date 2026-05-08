import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import {
  CriarExercicioRequestSchema,
  type CriarExercicioRequest,
} from '@amfit/shared';
import { useCriarExercicio } from '@/features/exercicios/hooks/useCriarExercicio';
import { GrupoMuscularPicker } from '@/features/exercicios/components/GrupoMuscularPicker';
import { MidiaPicker } from '@/features/exercicios/components/MidiaPicker';
import { ApiError } from '@/shared/lib/api-client';
import type { MidiaInput } from '@/features/exercicios/services/exercicio.service';

type FieldName = keyof CriarExercicioRequest;

export default function NovoExercicioScreen() {
  const router = useRouter();
  const [midia, setMidia] = useState<MidiaInput | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { mutate, isPending } = useCriarExercicio();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CriarExercicioRequest>({
    resolver: zodResolver(CriarExercicioRequestSchema),
    defaultValues: {
      nome: '',
      grupo_muscular_id: '',
      descricao: '',
    },
  });

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => {
      router.back();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [success, router]);

  function handleSalvar(values: CriarExercicioRequest) {
    setSubmitError(null);

    mutate(
      { data: values, midia },
      {
        onSuccess: () => {
          setSuccess(true);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 422) {
            const parsed = parseValidationError(err.message);
            if (parsed) {
              for (const [field, message] of Object.entries(parsed)) {
                if (isFieldName(field)) {
                  setError(field, { message });
                }
              }
              return;
            }
          }

          if (err instanceof ApiError) {
            setSubmitError(humanizeApiError(err));
          } else {
            setSubmitError(
              'Não foi possível salvar o exercício. Tente novamente.',
            );
          }
        },
      },
    );
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
            <Text className="mb-1 text-sm font-medium text-gray-700">
              Nome *
            </Text>
            <Controller
              control={control}
              name="nome"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-900 ${
                    errors.nome ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Supino Reto com Barra"
                  placeholderTextColor="#94a3b8"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  accessibilityLabel="Nome do exercício"
                  accessibilityState={{ disabled: isPending }}
                  editable={!isPending}
                />
              )}
            />
            {errors.nome && (
              <Text
                className="mt-1 text-xs text-red-500"
                accessibilityRole="alert"
              >
                {errors.nome.message}
              </Text>
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              Grupo muscular *
            </Text>
            <Controller
              control={control}
              name="grupo_muscular_id"
              render={({ field: { onChange, value } }) => (
                <GrupoMuscularPicker
                  value={value}
                  onChange={onChange}
                  hasError={!!errors.grupo_muscular_id}
                />
              )}
            />
            {errors.grupo_muscular_id && (
              <Text
                className="mt-1 text-xs text-red-500"
                accessibilityRole="alert"
              >
                {errors.grupo_muscular_id.message}
              </Text>
            )}
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              Descrição
            </Text>
            <Controller
              control={control}
              name="descricao"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900"
                  placeholder="Descreva a execução do exercício..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  accessibilityLabel="Descrição do exercício"
                  editable={!isPending}
                />
              )}
            />
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">
              Mídia
            </Text>
            <MidiaPicker value={midia} onChange={setMidia} />
          </View>

          {submitError && (
            <View
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              accessibilityRole="alert"
            >
              <Text className="text-sm text-red-600">{submitError}</Text>
            </View>
          )}

          {success && (
            <View
              className="rounded-lg border border-green-200 bg-green-50 px-3 py-2"
              accessibilityRole="alert"
            >
              <Text className="text-sm text-green-700">
                Exercício criado com sucesso!
              </Text>
            </View>
          )}

          <TouchableOpacity
            className={`mt-4 items-center rounded-lg bg-primary py-3 ${
              isPending || success ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit(handleSalvar)}
            disabled={isPending || success}
            accessibilityRole="button"
            accessibilityLabel="Salvar exercício"
            accessibilityState={{ busy: isPending, disabled: isPending || success }}
          >
            <Text className="font-semibold text-white">
              {isPending ? 'Salvando...' : 'Salvar Exercício'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const FIELD_NAMES: readonly FieldName[] = [
  'nome',
  'grupo_muscular_id',
  'descricao',
];

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

function parseValidationError(
  raw: string,
): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (obj.errors && typeof obj.errors === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(
          obj.errors as Record<string, unknown>,
        )) {
          if (typeof v === 'string') out[k] = v;
          else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
        }
        return Object.keys(out).length ? out : null;
      }
    }
  } catch {
    // não é JSON estruturado
  }
  return null;
}

function humanizeApiError(err: ApiError): string {
  if (err.status === 413) return 'Arquivo de mídia muito grande.';
  if (err.status === 415)
    return 'Formato de mídia não suportado. Envie uma imagem ou vídeo válido.';
  if (err.status >= 500)
    return 'Erro no servidor. Tente novamente em instantes.';
  return err.message || 'Não foi possível salvar o exercício.';
}
