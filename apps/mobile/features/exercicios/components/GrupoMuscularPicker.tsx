import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useGruposMusculares } from '../hooks/useGruposMusculares';

type Props = {
  value: string;
  onChange: (id: string) => void;
  hasError?: boolean;
};

export function GrupoMuscularPicker({ value, onChange, hasError }: Props) {
  const [open, setOpen] = useState(false);
  const { data: grupos, isLoading, isError } = useGruposMusculares();

  const selected = grupos?.find((g) => g.id === value);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        className={`w-full flex-row items-center justify-between rounded-lg border px-4 py-3 ${
          hasError ? 'border-red-500' : 'border-gray-300'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Selecionar grupo muscular"
        accessibilityState={{ expanded: open }}
      >
        <Text
          className={`text-sm ${
            selected ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {selected
            ? selected.nome
            : isLoading
              ? 'Carregando grupos...'
              : 'Selecione um grupo muscular'}
        </Text>
        <ChevronDown color="#64748b" size={18} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar seleção"
        >
          <Pressable
            className="mx-6 mt-24 max-h-[60%] rounded-xl bg-white"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="text-base font-semibold text-gray-900">
                Grupo muscular
              </Text>
            </View>

            {isError ? (
              <View className="px-4 py-6">
                <Text className="text-sm text-red-500">
                  Não foi possível carregar os grupos musculares.
                </Text>
              </View>
            ) : (
              <FlatList
                data={grupos ?? []}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => (
                  <View className="h-px bg-gray-100" />
                )}
                ListEmptyComponent={
                  <View className="px-4 py-6">
                    <Text className="text-sm text-gray-500">
                      {isLoading
                        ? 'Carregando...'
                        : 'Nenhum grupo muscular disponível.'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const active = item.id === value;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                      className="flex-row items-center justify-between px-4 py-3"
                      accessibilityRole="button"
                      accessibilityLabel={`Selecionar ${item.nome}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        className={`text-sm ${
                          active ? 'font-semibold text-primary' : 'text-gray-900'
                        }`}
                      >
                        {item.nome}
                      </Text>
                      {active && <Check color="#f97316" size={16} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
