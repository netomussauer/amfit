import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Film, Wallet } from 'lucide-react-native';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useAlunoMe } from '@/features/perfil/hooks/useAlunoMe';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="border-b border-gray-100 py-3">
      <Text className="text-xs uppercase tracking-wide text-gray-400">{label}</Text>
      <Text className="mt-1 text-base text-gray-900">{value || '—'}</Text>
    </View>
  );
}

function ProfileSkeleton() {
  return (
    <View className="mt-6 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="h-14 rounded-lg bg-gray-100" />
      ))}
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const { mutate: doLogout, isPending: isLoggingOut } = useLogout();
  const { data: aluno, isLoading, isError, refetch } = useAlunoMe();

  function handleLogout() {
    doLogout();
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 }}
    >
      <Text className="text-2xl font-bold text-gray-900">Perfil</Text>
      <Text className="mt-1 text-sm text-gray-500">
        Suas informações pessoais.
      </Text>

      {isLoading && <ProfileSkeleton />}

      {isError && !isLoading && (
        <View className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4">
          <Text className="text-sm text-red-700" accessibilityRole="alert">
            Não foi possível carregar seu perfil.
          </Text>
          <TouchableOpacity
            className="mt-3 self-start rounded-md bg-red-100 px-3 py-2"
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text className="text-sm font-medium text-red-700">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {aluno && (
        <View className="mt-6">
          <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <Text className="text-lg font-semibold text-gray-900">{aluno.nome}</Text>
            <Text className="mt-1 text-sm text-gray-500">{aluno.email}</Text>
          </View>

          <View className="mt-6">
            <FieldRow label="Nome" value={aluno.nome} />
            <FieldRow label="E-mail" value={aluno.email} />
            <FieldRow label="Telefone" value={aluno.telefone ?? null} />
            <FieldRow
              label="Data de nascimento"
              value={formatDate(aluno.data_nascimento)}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(aluno)/mensalidade')}
            activeOpacity={0.7}
            className="mt-4 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            accessibilityRole="button"
            accessibilityLabel="Ver minha mensalidade"
          >
            <View className="flex-row items-center gap-2">
              <Wallet color="#f97316" size={18} />
              <Text className="text-sm font-medium text-gray-900">Minha mensalidade</Text>
            </View>
            <ChevronRight color="#94a3b8" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(aluno)/coach-video')}
            activeOpacity={0.7}
            className="mt-3 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            accessibilityRole="button"
            accessibilityLabel="Enviar vídeo pro coach"
          >
            <View className="flex-row items-center gap-2">
              <Film color="#f97316" size={18} />
              <Text className="text-sm font-medium text-gray-900">Enviar vídeo pro coach</Text>
            </View>
            <ChevronRight color="#94a3b8" size={18} />
          </TouchableOpacity>
        </View>
      )}

      <View className="mt-auto pt-8">
        <TouchableOpacity
          className="items-center rounded-lg border border-red-200 bg-red-50 py-3 disabled:opacity-50"
          onPress={handleLogout}
          disabled={isLoggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          accessibilityState={{ busy: isLoggingOut, disabled: isLoggingOut }}
        >
          <Text className="font-medium text-red-600">
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
