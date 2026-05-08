import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type SkeletonBlockProps = {
  className?: string;
  style?: object;
};

function SkeletonBlock({ className, style }: SkeletonBlockProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`rounded-md bg-gray-200 ${className ?? ''}`}
      style={[animatedStyle, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function TreinoSkeleton() {
  return (
    <View
      className="rounded-xl border border-gray-200 bg-white p-4"
      accessibilityLabel="Carregando treino de hoje"
      accessibilityRole="progressbar"
    >
      <View className="mb-4 flex-row items-center gap-3">
        <SkeletonBlock className="h-12 w-12" />
        <View className="flex-1 gap-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-3 w-32" />
        </View>
      </View>

      {[0, 1, 2].map((idx) => (
        <View key={idx} className="mt-3 flex-row items-center gap-3">
          <SkeletonBlock className="h-[60px] w-[60px]" />
          <View className="flex-1 gap-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-3 w-1/3" />
          </View>
        </View>
      ))}
    </View>
  );
}
