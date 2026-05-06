import { Stack } from 'expo-router';

export default function ExerciciosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#f97316',
        headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Exercícios' }} />
      <Stack.Screen name="novo" options={{ title: 'Novo Exercício' }} />
    </Stack>
  );
}
