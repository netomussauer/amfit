import { Stack } from 'expo-router';

export default function TreinoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Animação de slide-up para evocar a sensação de "entrar no treino".
        presentation: 'card',
      }}
    />
  );
}
