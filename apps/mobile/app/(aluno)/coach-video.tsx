import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Film, Send } from 'lucide-react-native';
import { useMeusVideos } from '@/features/coach/hooks/useMeusVideos';
import { useEnviarVideo } from '@/features/coach/hooks/useEnviarVideo';
import type { VideoInput } from '@/features/coach/services/coach.service';

const DURACAO_MAXIMA_SEGUNDOS = 60;

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_FEEDBACK: 'Aguardando feedback',
  FEEDBACK_ENVIADO: 'Feedback recebido',
  ARQUIVADO: 'Arquivado',
};

export default function CoachVideoScreen() {
  const router = useRouter();
  const [video, setVideo] = useState<(VideoInput & { duracaoSegundos: number }) | null>(null);
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState<string | null>(null);

  const meusVideos = useMeusVideos({ per_page: 10 });
  const { mutate: enviarVideo, isPending } = useEnviarVideo();

  async function handleSelecionarVideo() {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão de acesso aos vídeos negada.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const duracaoSegundos = asset.duration ? Math.round(asset.duration / 1000) : 0;

    if (duracaoSegundos <= 0) {
      setError('Não foi possível determinar a duração do vídeo.');
      return;
    }
    if (duracaoSegundos > DURACAO_MAXIMA_SEGUNDOS) {
      setError(`O vídeo deve ter no máximo ${DURACAO_MAXIMA_SEGUNDOS}s.`);
      return;
    }

    setVideo({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'video/mp4',
      fileName: asset.fileName ?? `coach-video-${Date.now()}.mp4`,
      duracaoSegundos,
    });
  }

  function handleEnviar() {
    if (!video) return;
    setError(null);

    enviarVideo(
      {
        video: { uri: video.uri, mimeType: video.mimeType, fileName: video.fileName },
        duracaoSegundos: video.duracaoSegundos,
        descricao: descricao || undefined,
      },
      {
        onSuccess: () => {
          setVideo(null);
          setDescricao('');
        },
        onError: () => {
          setError('Não foi possível enviar o vídeo. Tente novamente.');
        },
      },
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-2 border-b border-gray-100 px-6 pb-3 pt-12">
        <TouchableOpacity
          onPress={() => router.back()}
          className="-ml-2 h-9 w-9 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
        >
          <ArrowLeft color="#0f172a" size={22} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900" accessibilityRole="header">
          Enviar vídeo pro coach
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={meusVideos.isRefetching}
            onRefresh={() => {
              void meusVideos.refetch();
            }}
            tintColor="#f97316"
          />
        }
      >
        <Text className="text-sm text-gray-500">
          Grave a execução de um exercício (até {DURACAO_MAXIMA_SEGUNDOS}s) com a câmera do
          celular e selecione o vídeo da galeria pra pedir uma revisão do seu personal.
        </Text>

        {video ? (
          <View className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <VideoPreview uri={video.uri} />
            <Text className="mt-2 text-xs text-gray-500">{video.duracaoSegundos}s</Text>
            <TouchableOpacity
              onPress={handleSelecionarVideo}
              className="mt-2 rounded-lg border border-gray-300 bg-white py-2"
              accessibilityRole="button"
              accessibilityLabel="Trocar vídeo"
            >
              <Text className="text-center text-sm font-medium text-gray-700">Trocar vídeo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSelecionarVideo}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6"
            accessibilityRole="button"
            accessibilityLabel="Selecionar vídeo da galeria"
          >
            <Film color="#64748b" size={20} />
            <Text className="text-sm font-medium text-gray-600">Selecionar vídeo</Text>
          </TouchableOpacity>
        )}

        {error && (
          <Text className="mt-2 text-xs text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        )}

        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="O que você quer que o personal observe? (opcional)"
          multiline
          numberOfLines={3}
          className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          accessibilityLabel="Descrição do que quer feedback"
        />

        <TouchableOpacity
          onPress={handleEnviar}
          disabled={!video || isPending}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3 disabled:opacity-50"
          accessibilityRole="button"
          accessibilityLabel="Enviar vídeo pro personal"
          accessibilityState={{ disabled: !video || isPending, busy: isPending }}
        >
          <Send color="#ffffff" size={16} />
          <Text className="text-sm font-medium text-white">
            {isPending ? 'Enviando...' : 'Enviar pro personal'}
          </Text>
        </TouchableOpacity>

        <Text className="mt-8 text-sm font-semibold text-gray-900">Vídeos enviados</Text>
        <View className="mt-2 gap-2">
          {meusVideos.isLoading ? (
            <ActivityIndicator color="#f97316" style={{ marginTop: 12 }} />
          ) : (meusVideos.data?.data.length ?? 0) === 0 ? (
            <Text className="text-sm text-gray-500">Você ainda não enviou nenhum vídeo.</Text>
          ) : (
            meusVideos.data?.data.map((v) => (
              <View
                key={v.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-gray-900">
                    {v.exercicio_nome ?? 'Vídeo'}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {STATUS_LABEL[v.status] ?? v.status}
                  </Text>
                </View>
                {v.feedback && (
                  <Text className="mt-1 text-xs text-gray-600">{v.feedback.texto}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 192, borderRadius: 8 }}
      contentFit="cover"
      nativeControls
      accessibilityLabel="Pré-visualização do vídeo selecionado"
    />
  );
}
