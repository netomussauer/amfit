import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useExercicios } from '@/features/exercicios/hooks/useExercicios';
import { useGruposMusculares } from '@/features/exercicios/hooks/useGruposMusculares';
import { ExercicioCard } from '@/features/exercicios/components/ExercicioCard';
import { GrupoChips } from '@/features/exercicios/components/GrupoChips';

export default function ExerciciosScreen() {
  const router = useRouter();
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const params = useMemo(
    () => ({
      grupo_muscular_id: grupoId ?? undefined,
      busca: busca.trim() ? busca.trim() : undefined,
    }),
    [grupoId, busca],
  );

  const {
    data,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useExercicios(params);

  const {
    data: grupos,
    isLoading: gruposLoading,
  } = useGruposMusculares();

  const exercicios = data?.data ?? [];

  return (
    <View className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-900">
          Todos os exercícios
        </Text>
        <TouchableOpacity
          className="flex-row items-center gap-1 rounded-lg bg-primary px-3 py-2"
          onPress={() => router.push('/(personal)/exercicios/novo')}
          accessibilityRole="button"
          accessibilityLabel="Adicionar novo exercício"
        >
          <Plus color="#ffffff" size={16} />
          <Text className="text-sm font-medium text-white">Novo</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 py-2">
        <View className="flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Search color="#94a3b8" size={16} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar exercício..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-sm text-gray-900"
            accessibilityLabel="Buscar exercício pelo nome"
            returnKeyType="search"
          />
        </View>
      </View>

      <GrupoChips
        grupos={grupos ?? []}
        selectedId={grupoId}
        onSelect={setGrupoId}
        isLoading={gruposLoading}
      />

      {isLoading && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f97316" />
          <Text className="mt-2 text-sm text-gray-500">
            Carregando exercícios...
          </Text>
        </View>
      ) : (
        <FlatList
          data={exercicios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
              tintColor="#f97316"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              {isError ? (
                <>
                  <Text className="text-sm font-medium text-red-500">
                    Não foi possível carregar os exercícios.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      void refetch();
                    }}
                    className="mt-3 rounded-lg bg-primary px-4 py-2"
                    accessibilityRole="button"
                    accessibilityLabel="Tentar novamente"
                  >
                    <Text className="text-sm font-medium text-white">
                      Tentar novamente
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text className="text-gray-500">
                    Nenhum exercício encontrado.
                  </Text>
                  <Text className="mt-1 text-sm text-gray-400">
                    Toque em "Novo" para adicionar um exercício.
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ExercicioCard
              exercicio={item}
              onPress={(ex) =>
                router.push(`/(personal)/exercicios/${ex.id}` as never)
              }
            />
          )}
        />
      )}
    </View>
  );
}
