import { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import type { MidiaInput } from '../services/exercicio.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

type Props = {
  value: MidiaInput | null;
  onChange: (midia: MidiaInput | null) => void;
};

export function MidiaPicker({ value, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handlePick() {
    setError(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permissão de acesso às fotos negada.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (asset.fileSize && asset.fileSize > maxBytes) {
      setError(
        isVideo
          ? 'O vídeo deve ter no máximo 10MB.'
          : 'A imagem deve ter no máximo 5MB.',
      );
      return;
    }

    const fallbackMime = isVideo ? 'video/mp4' : 'image/jpeg';
    const fallbackExt = isVideo ? 'mp4' : 'jpg';

    onChange({
      uri: asset.uri,
      mimeType: asset.mimeType ?? fallbackMime,
      fileName: asset.fileName ?? `midia-${Date.now()}.${fallbackExt}`,
    });
  }

  function handleRemove() {
    setError(null);
    onChange(null);
  }

  if (!value) {
    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePick}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6"
          accessibilityRole="button"
          accessibilityLabel="Selecionar mídia do exercício"
        >
          <ImagePlus color="#64748b" size={20} />
          <Text className="text-sm font-medium text-gray-600">
            Selecionar mídia
          </Text>
        </TouchableOpacity>
        <Text className="mt-1 text-xs text-gray-400">
          Imagem (até 5MB) ou vídeo (até 10MB).
        </Text>
        {error && (
          <Text
            className="mt-1 text-xs text-red-500"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <MidiaPreview midia={value} />
      <View className="mt-3 flex-row gap-2">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePick}
          className="flex-1 rounded-lg border border-gray-300 bg-white py-2"
          accessibilityRole="button"
          accessibilityLabel="Trocar mídia"
        >
          <Text className="text-center text-sm font-medium text-gray-700">
            Trocar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleRemove}
          className="flex-row items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel="Remover mídia"
        >
          <Trash2 color="#ef4444" size={16} />
          <Text className="text-sm font-medium text-red-500">Remover</Text>
        </TouchableOpacity>
      </View>
      {error && (
        <Text className="mt-2 text-xs text-red-500" accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

function MidiaPreview({ midia }: { midia: MidiaInput }) {
  const isVideo = midia.mimeType.startsWith('video/');

  if (isVideo) {
    return <VideoPreview uri={midia.uri} />;
  }

  return (
    <Image
      source={{ uri: midia.uri }}
      className="h-48 w-full rounded-lg"
      resizeMode="cover"
      accessibilityLabel="Pré-visualização da imagem selecionada"
    />
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
