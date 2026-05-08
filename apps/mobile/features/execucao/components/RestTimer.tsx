import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SkipForward } from 'lucide-react-native';

type Props = {
  visible: boolean;
  /** Duração total do descanso em segundos. */
  duracaoSegundos: number;
  onComplete: () => void;
  onSkip: () => void;
};

/**
 * Cronômetro de descanso em modal.
 *
 * Implementação sem react-native-svg: o anel de progresso é construído com dois
 * meio-círculos (clipping via overflow-hidden + rotação) usando Reanimated.
 * Para uma versão mais simples e robusta neste primeiro corte, optamos por um
 * indicador linear (barra horizontal) animado com Reanimated — tem menos
 * complexidade visual mas é totalmente estável em ambos plataformas.
 */
export function RestTimer({ visible, duracaoSegundos, onComplete, onSkip }: Props) {
  const [restantes, setRestantes] = useState(duracaoSegundos);
  const progress = useSharedValue(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    setRestantes(duracaoSegundos);
    progress.value = 1;
    completedRef.current = false;

    progress.value = withTiming(0, {
      duration: duracaoSegundos * 1000,
      easing: Easing.linear,
    });

    intervalRef.current = setInterval(() => {
      setRestantes((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (!completedRef.current) {
            completedRef.current = true;
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
            // Pequeno delay antes de chamar onComplete para o usuário ver o "0"
            setTimeout(onComplete, 250);
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, duracaoSegundos, onComplete, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  function handleSkip() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    completedRef.current = true;
    onSkip();
  }

  const minutos = Math.floor(restantes / 60);
  const segundos = restantes % 60;
  const tempoFormatado = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-8">
        <View
          className="w-full items-center rounded-2xl bg-white px-6 py-8"
          accessibilityRole="alert"
          accessibilityLabel={`Descanso ${tempoFormatado}`}
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Descanso
          </Text>

          <Text className="mt-2 text-6xl font-bold text-primary tabular-nums">
            {tempoFormatado}
          </Text>

          <Text className="mt-1 text-sm text-gray-500">
            Recupere para a próxima série
          </Text>

          <View className="mt-6 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <Animated.View
              style={barStyle}
              className="h-2 rounded-full bg-primary"
            />
          </View>

          <TouchableOpacity
            onPress={handleSkip}
            className="mt-6 flex-row items-center gap-2 rounded-lg border border-gray-300 px-4 py-2"
            accessibilityRole="button"
            accessibilityLabel="Pular descanso"
          >
            <SkipForward color="#475569" size={16} />
            <Text className="text-sm font-medium text-gray-700">
              Pular descanso
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
