import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Film, RefreshCw, Wallet } from 'lucide-react-native';
import { useConfirmarLogout } from '@/features/auth/hooks/useConfirmarLogout';
import { useAlunoMe } from '@/features/perfil/hooks/useAlunoMe';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { usePendingSyncCount } from '@/features/execucao/hooks/usePendingSyncCount';
import { useNeedsReauth } from '@/features/execucao/hooks/useNeedsReauth';
import { runDrain } from '@/features/execucao/lib/offlineSyncEngine';
import { pluralizar } from '@/shared/lib/pluralize';

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

type SincronizacaoPendenteCardProps = {
  pendingCount: number;
  needsReauth: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  onSincronizar: () => void;
};

function SincronizacaoPendenteCard({
  pendingCount,
  needsReauth,
  isOnline,
  isSyncing,
  onSincronizar,
}: SincronizacaoPendenteCardProps) {
  if (pendingCount === 0) return null;

  // Mesma prioridade de mensagem do OfflineBanner: needsReauth é a única
  // pendência acionável por aqui (as outras se resolvem sozinhas quando a
  // conexão volta).
  const hint = needsReauth
    ? 'Entre novamente para sincronizar'
    : !isOnline
      ? 'Aguardando conexão'
      : null;
  const podeSincronizar = isOnline && !needsReauth && !isSyncing;

  return (
    <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Text className="text-sm font-medium text-amber-800">
        {pendingCount} {pluralizar(pendingCount, 'ação pendente', 'ações pendentes')} de
        sincronizar
      </Text>
      {hint && <Text className="mt-1 text-xs text-amber-700">{hint}</Text>}
      <TouchableOpacity
        onPress={onSincronizar}
        disabled={!podeSincronizar}
        className="mt-3 flex-row items-center justify-center gap-2 self-start rounded-lg bg-amber-600 px-4 py-2 disabled:opacity-50"
        accessibilityRole="button"
        accessibilityLabel="Sincronizar agora"
        accessibilityState={{ disabled: !podeSincronizar, busy: isSyncing }}
      >
        <RefreshCw color="#fff" size={14} />
        <Text className="text-sm font-medium text-white">
          {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, isLoggingOut } = useConfirmarLogout();
  const { data: aluno, isLoading, isError, refetch } = useAlunoMe();
  const pendingCount = usePendingSyncCount();
  const needsReauth = useNeedsReauth();
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSincronizar() {
    setIsSyncing(true);
    try {
      await runDrain(queryClient);
    } finally {
      setIsSyncing(false);
    }
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

      <SincronizacaoPendenteCard
        pendingCount={pendingCount}
        needsReauth={needsReauth}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onSincronizar={handleSincronizar}
      />

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
          onPress={logout}
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
