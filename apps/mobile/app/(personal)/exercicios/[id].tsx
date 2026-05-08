import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  AlertTriangle,
  Dumbbell,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import type { ExercicioResponse } from '@amfit/shared';
import { useExercicio } from '@/features/exercicios/hooks/useExercicios';
import { useDesativarExercicio } from '@/features/exercicios/hooks/useDesativarExercicio';
import { ApiError } from '@/shared/lib/api-client';

export default function ExercicioDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exercicioId = typeof id === 'string' ? id : undefined;

  const { data: exercicio, isLoading, isError, refetch } =
    useExercicio(exercicioId);
  const { mutate: desativar, isPending: isDesativando } =
    useDesativarExercicio();

  const [removalError, setRemovalError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#f97316" />
        <Text className="mt-2 text-sm text-gray-500">
          Carregando exercício...
        </Text>
      </View>
    );
  }

  if (isError || !exercicio) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <AlertTriangle color="#dc2626" size={40} />
        <Text className="mt-3 text-base font-medium text-red-700">
          Não foi possível carregar o exercício
        </Text>
        <TouchableOpacity
          onPress={() => {
            void refetch();
          }}
          className="mt-4 rounded-lg bg-primary px-4 py-2"
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Text className="text-sm font-medium text-white">
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isGlobal = exercicio.is_global;

  function handleEditar() {
    Alert.alert(
      'Editar exercício',
      'A edição de exercícios pelo app mobile estará disponível em breve. Use o portal web para editar agora.',
      [{ text: 'OK' }],
    );
  }

  function handleRemover() {
    if (!exercicio || isGlobal) return;
    Alert.alert(
      'Remover exercício',
      `Tem certeza que deseja remover "${exercicio.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            setRemovalError(null);
            desativar(exercicio.id, {
              onSuccess: () => {
                router.back();
              },
              onError: (err) => {
                if (err instanceof ApiError) {
                  if (err.status === 409) {
                    setRemovalError(
                      'Este exercício está em uso em fichas ativas e não pode ser removido.',
                    );
                    return;
                  }
                  setRemovalError(
                    err.message || 'Não foi possível remover o exercício.',
                  );
                  return;
                }
                setRemovalError('Erro inesperado ao remover o exercício.');
              },
            });
          },
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 32,
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text
            className="flex-1 text-2xl font-bold text-gray-900"
            accessibilityRole="header"
          >
            {exercicio.nome}
          </Text>
          {isGlobal && (
            <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <Lock color="#f97316" size={12} />
              <Text className="text-xs font-semibold uppercase text-primary">
                Global
              </Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <ExercicioMidia exercicio={exercicio} />
        </View>

        <View className="mt-6">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Grupo muscular
          </Text>
          <View className="mt-2 self-start rounded-full bg-gray-100 px-3 py-1">
            <Text className="text-sm font-medium text-gray-700">
              {exercicio.grupo_muscular.nome}
            </Text>
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Descrição
          </Text>
          {exercicio.descricao ? (
            <Text className="mt-2 text-sm leading-relaxed text-gray-700">
              {exercicio.descricao}
            </Text>
          ) : (
            <Text className="mt-2 text-sm italic text-gray-400">
              Sem descrição cadastrada.
            </Text>
          )}
        </View>

        {removalError && (
          <View
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
            accessibilityRole="alert"
          >
            <Text className="text-sm text-red-600">{removalError}</Text>
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-3 border-t border-gray-100 bg-white px-6 py-4">
        <TouchableOpacity
          onPress={handleEditar}
          disabled={isGlobal || isDesativando}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-primary py-3 ${
            isGlobal || isDesativando ? 'opacity-40' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="Editar exercício"
          accessibilityState={{ disabled: isGlobal || isDesativando }}
          accessibilityHint={
            isGlobal ? 'Exercícios globais não podem ser editados' : undefined
          }
        >
          <Pencil color="#f97316" size={16} />
          <Text className="text-sm font-semibold text-primary">Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRemover}
          disabled={isGlobal || isDesativando}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 ${
            isGlobal || isDesativando ? 'opacity-40' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="Remover exercício"
          accessibilityState={{
            disabled: isGlobal || isDesativando,
            busy: isDesativando,
          }}
          accessibilityHint={
            isGlobal ? 'Exercícios globais não podem ser removidos' : undefined
          }
        >
          <Trash2 color="#ffffff" size={16} />
          <Text className="text-sm font-semibold text-white">
            {isDesativando ? 'Removendo...' : 'Remover'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ExercicioMidia({ exercicio }: { exercicio: ExercicioResponse }) {
  if (!exercicio.midia_url) {
    return (
      <View
        className="h-56 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50"
        accessibilityLabel="Sem mídia cadastrada para este exercício"
      >
        <Dumbbell color="#94a3b8" size={48} />
        <Text className="mt-2 text-sm text-gray-500">Sem mídia</Text>
      </View>
    );
  }

  if (exercicio.tipo_midia === 'VIDEO') {
    return <ExercicioVideo uri={exercicio.midia_url} />;
  }

  return (
    <Image
      source={{ uri: exercicio.midia_url }}
      style={{ width: '100%', height: 224, borderRadius: 12 }}
      resizeMode="cover"
      accessibilityLabel={`Mídia do exercício ${exercicio.nome}`}
    />
  );
}

function ExercicioVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 224, borderRadius: 12 }}
      contentFit="cover"
      nativeControls
      accessibilityLabel="Vídeo do exercício"
    />
  );
}
