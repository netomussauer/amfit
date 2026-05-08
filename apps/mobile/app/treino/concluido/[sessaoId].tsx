import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trophy, Clock, Dumbbell, ListChecks } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useSessao } from '@/features/execucao/hooks/useSessao';
import { useMinhaFicha } from '@/features/treino/hooks/useMinhaFicha';

function formatDuracao(iniciadoEm: string, concluidoEm: string | null | undefined): string {
  if (!concluidoEm) return '—';
  const start = new Date(iniciadoEm).getTime();
  const end = new Date(concluidoEm).getTime();
  const diffMin = Math.max(0, Math.round((end - start) / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const horas = Math.floor(diffMin / 60);
  const minutos = diffMin % 60;
  return `${horas}h ${minutos}min`;
}

function formatCargaTotal(kg: number): string {
  if (kg === 0) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace('.', ',')} kg`;
}

export default function TreinoConcluidoScreen() {
  const { sessaoId: rawSessaoId } = useLocalSearchParams<{ sessaoId: string }>();
  const sessaoId = typeof rawSessaoId === 'string' ? rawSessaoId : '';
  const router = useRouter();

  const { data: sessao } = useSessao(sessaoId);
  const { data: ficha } = useMinhaFicha();

  const treino = useMemo(() => {
    if (!sessao || !ficha) return null;
    return ficha.treinos.find((t) => t.id === sessao.treino_id) ?? null;
  }, [sessao, ficha]);

  const seriesConcluidas = sessao?.series.filter((s) => s.concluida).length ?? 0;
  const cargaTotal = useMemo(() => {
    if (!sessao) return 0;
    return sessao.series.reduce((acc, s) => {
      if (!s.concluida) return acc;
      const carga = s.carga_realizada ?? 0;
      const reps = s.repeticoes_realizadas ?? 0;
      return acc + carga * reps;
    }, 0);
  }, [sessao]);

  const duracao = sessao
    ? formatDuracao(sessao.iniciado_em, sessao.concluido_em)
    : '—';

  function handleVoltar() {
    router.replace('/(aluno)/');
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
      }}
    >
      <Animated.View entering={ZoomIn.duration(400)} className="items-center">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <Trophy color="#f97316" size={56} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).duration(400)}>
        <Text
          className="mt-6 text-center text-3xl font-bold text-gray-900"
          accessibilityRole="header"
        >
          Treino concluído!
        </Text>
        {treino && (
          <Text className="mt-2 text-center text-sm text-gray-500">
            Treino {treino.letra}
            {treino.nome ? ` · ${treino.nome}` : ''}
          </Text>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        className="mt-8 gap-3"
      >
        <ResumoLinha
          icon={<ListChecks color="#f97316" size={20} />}
          label="Séries concluídas"
          value={`${seriesConcluidas}`}
        />
        <ResumoLinha
          icon={<Dumbbell color="#f97316" size={20} />}
          label="Carga total movimentada"
          value={formatCargaTotal(cargaTotal)}
        />
        <ResumoLinha
          icon={<Clock color="#f97316" size={20} />}
          label="Duração"
          value={duracao}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(450).duration(400)} className="mt-10">
        <TouchableOpacity
          onPress={handleVoltar}
          className="items-center rounded-lg bg-primary py-4"
          accessibilityRole="button"
          accessibilityLabel="Voltar para o início"
        >
          <Text className="text-base font-semibold text-white">
            Voltar para início
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

type ResumoLinhaProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function ResumoLinha({ icon, label, value }: ResumoLinhaProps) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs uppercase text-gray-500">{label}</Text>
        <Text className="text-base font-semibold text-gray-900">{value}</Text>
      </View>
    </View>
  );
}
