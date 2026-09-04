import { forwardRef } from 'react';
import { View, Text } from 'react-native';

// Dados exibidos no card — deliberadamente só o que já está disponível no
// client hoje (série/carga/duração da própria sessão). Sem PRs batidos
// (detecção de recorde pessoal não existe neste codebase ainda — mesmo
// gap encontrado ao implementar notificações push) nem logo do personal
// (White Label é Fase 3, tenant_config não existe). Nenhum dado sensível
// (peso corporal, fotos de evolução) é exibido — a tela de origem nem
// tem acesso a esses dados, então a exclusão é automática.
export type ShareCardData = {
  treinoLetra: string;
  treinoNome?: string;
  dataExecucaoFormatada: string;
  totalSeries: number;
  totalExercicios: number;
  cargaTotalFormatada: string;
  duracaoFormatada: string;
};

type ShareCardProps = {
  data: ShareCardData;
};

// Renderizado offscreen (ver uso em app/treino/concluido/[sessaoId].tsx) —
// só existe pra ser capturado com react-native-view-shot, nunca é
// mostrado na tela normalmente. `collapsable={false}` é necessário no
// Android: sem isso o motor de otimização de view pode "achatar" a
// hierarquia e a captura sai em branco.
export const ShareCard = forwardRef<View, ShareCardProps>(({ data }, ref) => (
  <View
    ref={ref}
    collapsable={false}
    className="h-[560px] w-[360px] justify-between rounded-2xl bg-slate-900 p-8"
  >
    <View>
      <Text className="text-sm font-bold uppercase tracking-widest text-primary">
        AMFIT
      </Text>
      <Text className="mt-8 text-3xl font-bold text-white">
        Treino {data.treinoLetra}
        {data.treinoNome ? ` · ${data.treinoNome}` : ''}
      </Text>
      <Text className="mt-1 text-sm text-slate-400">{data.dataExecucaoFormatada}</Text>
    </View>

    <View className="gap-5">
      <ShareCardStat label="Séries concluídas" value={`${data.totalSeries}`} />
      <ShareCardStat label="Exercícios" value={`${data.totalExercicios}`} />
      <ShareCardStat label="Carga total" value={data.cargaTotalFormatada} />
      <ShareCardStat label="Duração" value={data.duracaoFormatada} />
    </View>
  </View>
));
ShareCard.displayName = 'ShareCard';

function ShareCardStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="text-2xl font-semibold text-white">{value}</Text>
    </View>
  );
}
