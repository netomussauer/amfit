import { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trophy, Clock, Dumbbell, ListChecks, Share2 } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useSessao } from '@/features/execucao/hooks/useSessao';
import { ShareCard, capturarCardTreino, abrirShareSheet } from '@/features/execucao';

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

function formatDataExecucao(dataExecucao: string): string {
  // dataExecucao vem como YYYY-MM-DD (date-only) — parsear com `new Date`
  // direto interpretaria como UTC meia-noite e poderia exibir o dia
  // anterior em fusos negativos (Brasil). Monta a data local a partir das
  // partes pra evitar isso.
  const [ano, mes, dia] = dataExecucao.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function TreinoConcluidoScreen() {
  const { sessaoId: rawSessaoId } = useLocalSearchParams<{ sessaoId: string }>();
  const sessaoId = typeof rawSessaoId === 'string' ? rawSessaoId : '';
  const router = useRouter();

  const { data: sessao } = useSessao(sessaoId);
  // GET /sessoes/:id já devolve o treino embutido (SessaoResponseSchema.treino)
  // especificamente pra evitar uma 2ª requisição — usar isso em vez de
  // buscar a ficha ativa à parte elimina uma corrida real: sessao e ficha
  // vêm de queries independentes, então tocar "Compartilhar" antes da
  // ficha terminar de carregar gerava um card com letra/nome em branco
  // (achado de code-review).
  const treino = sessao?.treino ?? null;

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

  const totalExercicios = useMemo(() => {
    if (!sessao) return 0;
    const itensComSerieConcluida = new Set(
      sessao.series.filter((s) => s.concluida).map((s) => s.item_treino_id),
    );
    return itensComSerieConcluida.size;
  }, [sessao]);

  const duracao = sessao
    ? formatDuracao(sessao.iniciado_em, sessao.concluido_em)
    : '—';

  const cardRef = useRef<View>(null);
  const [compartilhando, setCompartilhando] = useState(false);

  function handleVoltar() {
    router.replace('/(aluno)/');
  }

  async function handleCompartilhar() {
    // "Preparando..." só cobre a captura do card (rápida) — o share sheet
    // nativo em si não entra nesse loading: ele pode ficar aberto por
    // tempo indefinido (usuário escolhendo destino ou só segurando o
    // celular) e o botão não deveria continuar preso em "Preparando..."
    // por todo esse tempo (achado de code-review).
    setCompartilhando(true);
    const uri = await capturarCardTreino(cardRef);
    setCompartilhando(false);
    if (uri) {
      void abrirShareSheet(uri);
    }
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

      <Animated.View entering={FadeInUp.delay(450).duration(400)} className="mt-10 gap-3">
        <TouchableOpacity
          onPress={handleCompartilhar}
          disabled={compartilhando || !sessao}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-primary py-4 disabled:opacity-50"
          accessibilityRole="button"
          accessibilityLabel="Compartilhar treino"
        >
          <Share2 color="#f97316" size={18} />
          <Text className="text-base font-semibold text-primary">
            {compartilhando ? 'Preparando...' : 'Compartilhar'}
          </Text>
        </TouchableOpacity>

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

      {sessao && (
        // Offscreen — só existe pra ser capturado por react-native-view-shot
        // (ver compartilharTreinoConcluido). `left: -9999` em vez de
        // opacity/display:none porque alguns engines de captura tiram
        // screenshot em branco de views não-visíveis por opacidade.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: -9999 }}
        >
          <ShareCard
            ref={cardRef}
            data={{
              treinoLetra: treino?.letra ?? '',
              treinoNome: treino?.nome ?? undefined,
              dataExecucaoFormatada: formatDataExecucao(sessao.data_execucao),
              totalSeries: seriesConcluidas,
              totalExercicios,
              cargaTotalFormatada: formatCargaTotal(cargaTotal),
              duracaoFormatada: duracao,
            }}
          />
        </View>
      )}
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
