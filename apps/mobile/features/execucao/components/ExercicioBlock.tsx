import { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, Dumbbell } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';
import { SerieRow } from './SerieRow';

type Props = {
  item: ItemTreinoResponse;
  registros: RegistroSerieResponse[];
  onRegistrarSerie: (input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) => void;
};

function formatCarga(carga: number | null | undefined): string | null {
  if (carga === null || carga === undefined) return null;
  const formatted = Number.isInteger(carga)
    ? String(carga)
    : carga.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} kg`;
}

export function ExercicioBlock({ item, registros, onRegistrarSerie }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { exercicio } = item;
  const carga = formatCarga(item.carga_sugerida);
  const concluidas = registros.filter((r) => r.concluida).length;
  const totalSeries = item.series;

  return (
    <View className="rounded-xl border border-gray-200 bg-white">
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center gap-3 px-3 py-3"
        accessibilityRole="button"
        accessibilityLabel={`${exercicio.nome}, ${concluidas} de ${totalSeries} séries concluídas. Toque para ${expanded ? 'recolher' : 'expandir'} mídia`}
        accessibilityState={{ expanded }}
      >
        <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {exercicio.midia_url &&
          (exercicio.tipo_midia === 'IMAGEM' || exercicio.tipo_midia === 'GIF') ? (
            <Image
              source={{ uri: exercicio.midia_url }}
              className="h-14 w-14"
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Dumbbell color="#94a3b8" size={22} />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {exercicio.nome}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
            {exercicio.grupo_muscular.nome}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full bg-primary/10 px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-primary">
                {item.series}×{item.repeticoes}
              </Text>
            </View>
            {carga && (
              <Text className="text-[11px] text-gray-500">
                Sugerida: {carga}
              </Text>
            )}
          </View>
        </View>

        <View className="items-end">
          <Text className="text-xs font-semibold text-gray-700">
            {concluidas}/{totalSeries}
          </Text>
          {expanded ? (
            <ChevronUp color="#94a3b8" size={18} />
          ) : (
            <ChevronDown color="#94a3b8" size={18} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && exercicio.midia_url && exercicio.tipo_midia === 'VIDEO' && (
        <View className="px-3 pb-3">
          <ExercicioVideo uri={exercicio.midia_url} />
        </View>
      )}

      {expanded && item.observacao && (
        <View className="mx-3 mb-2 rounded-md bg-gray-50 px-3 py-2">
          <Text className="text-xs text-gray-600">{item.observacao}</Text>
        </View>
      )}

      <View className="gap-2 px-3 pb-3">
        {Array.from({ length: totalSeries }, (_, i) => i + 1).map((numero) => {
          const registro = registros.find((r) => r.numero_serie === numero);
          return (
            <SerieRow
              key={numero}
              item={item}
              numeroSerie={numero}
              registro={registro}
              onConcluir={onRegistrarSerie}
            />
          );
        })}
      </View>
    </View>
  );
}

function ExercicioVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 200, borderRadius: 8 }}
      contentFit="cover"
      nativeControls
      accessibilityLabel="Vídeo do exercício"
    />
  );
}
