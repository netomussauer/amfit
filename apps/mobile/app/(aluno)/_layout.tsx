import { Tabs } from 'expo-router';
import { Dumbbell, History, User } from 'lucide-react-native';

export default function AlunoLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Treino',
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => (
            <History color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ficha"
        options={{
          // Rota acessível via push da tab Treino — não exibe entrada na tab bar.
          href: null,
        }}
      />
      <Tabs.Screen
        name="progresso"
        options={{
          // Rota acessível via push da Ficha/Histórico — não exibe entrada na tab bar.
          href: null,
        }}
      />
      <Tabs.Screen
        name="mensalidade"
        options={{
          // Rota acessível via push do Perfil — não exibe entrada na tab bar.
          href: null,
        }}
      />
    </Tabs>
  );
}
