import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';

type Props = {
  item: ItemTreinoResponse;
  numeroSerie: number;
  registro: RegistroSerieResponse | undefined;
  onConcluir: (input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) => void;
};

function parseNumero(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseInteiro(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function formatCarga(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

export function SerieRow({ item, numeroSerie, registro, onConcluir }: Props) {
  const concluida = registro?.concluida ?? false;

  const [carga, setCarga] = useState<string>(() =>
    formatCarga(registro?.carga_realizada ?? item.carga_sugerida ?? null),
  );
  const [reps, setReps] = useState<string>(() =>
    registro?.repeticoes_realizadas != null
      ? String(registro.repeticoes_realizadas)
      : '',
  );

  // Sincroniza inputs quando o registro vindo do servidor muda (ex: refetch).
  useEffect(() => {
    if (registro) {
      setCarga(formatCarga(registro.carga_realizada ?? item.carga_sugerida ?? null));
      setReps(
        registro.repeticoes_realizadas != null
          ? String(registro.repeticoes_realizadas)
          : '',
      );
    }
  }, [registro, item.carga_sugerida]);

  function handleToggle() {
    const novaCondicao = !concluida;
    if (novaCondicao) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onConcluir({
      numero_serie: numeroSerie,
      item_treino_id: item.id,
      concluida: novaCondicao,
      carga_realizada: parseNumero(carga),
      repeticoes_realizadas: parseInteiro(reps),
    });
  }

  return (
    <View
      className={`flex-row items-center gap-3 rounded-lg border px-3 py-3 ${
        concluida
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <View
        className={`h-7 w-7 items-center justify-center rounded-full ${
          concluida ? 'bg-emerald-500' : 'bg-gray-100'
        }`}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Text
          className={`text-xs font-bold ${concluida ? 'text-white' : 'text-gray-600'}`}
        >
          {numeroSerie}
        </Text>
      </View>

      <View className="flex-1 flex-row gap-2">
        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-medium uppercase text-gray-500">
            Carga (kg)
          </Text>
          <TextInput
            value={carga}
            onChangeText={setCarga}
            keyboardType="decimal-pad"
            placeholder="--"
            editable={!concluida}
            className={`rounded-md border px-2 py-1.5 text-sm ${
              concluida
                ? 'border-emerald-200 bg-white text-gray-700'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
            accessibilityLabel={`Carga da série ${numeroSerie}`}
          />
        </View>

        <View className="flex-1">
          <Text className="mb-1 text-[10px] font-medium uppercase text-gray-500">
            Reps
          </Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder={item.repeticoes}
            editable={!concluida}
            className={`rounded-md border px-2 py-1.5 text-sm ${
              concluida
                ? 'border-emerald-200 bg-white text-gray-700'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
            accessibilityLabel={`Repetições da série ${numeroSerie}`}
          />
        </View>
      </View>

      <TouchableOpacity
        onPress={handleToggle}
        className={`h-12 w-12 items-center justify-center rounded-lg ${
          concluida ? 'bg-emerald-500' : 'border border-gray-300 bg-white'
        }`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: concluida }}
        accessibilityLabel={`Marcar série ${numeroSerie} como concluída`}
      >
        <Check color={concluida ? '#ffffff' : '#94a3b8'} size={22} />
      </TouchableOpacity>
    </View>
  );
}
