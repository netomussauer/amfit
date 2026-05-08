import { SessaoDetalhe } from '@/features/sessoes/components/SessaoDetalhe';

type Props = {
  params: { id: string; sessaoId: string };
};

export const metadata = {
  title: 'Sessão executada — AMFIT',
};

export default function SessaoDetalhePage({ params }: Props) {
  return (
    <div className="max-w-5xl">
      <SessaoDetalhe sessaoId={params.sessaoId} alunoId={params.id} />
    </div>
  );
}
