import { TreinoConcluidoResumo } from '@/features/execucao';

type Props = {
  params: { sessaoId: string };
};

export const metadata = {
  title: 'Treino concluído — AMFIT',
};

export default function TreinoConcluidoPage({ params }: Props) {
  return <TreinoConcluidoResumo sessaoId={params.sessaoId} />;
}
