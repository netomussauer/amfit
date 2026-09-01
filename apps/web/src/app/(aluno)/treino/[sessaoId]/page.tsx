import { ExecucaoTreino } from '@/features/execucao';

type Props = {
  params: { sessaoId: string };
};

export const metadata = {
  title: 'Executando treino — AMFIT',
};

export default function ExecucaoTreinoPage({ params }: Props) {
  return (
    <div className="max-w-2xl">
      <ExecucaoTreino sessaoId={params.sessaoId} />
    </div>
  );
}
