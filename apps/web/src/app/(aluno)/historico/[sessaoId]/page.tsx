import { MinhaSessaoDetalhe } from '@/features/meu-historico/components/MinhaSessaoDetalhe';

type Props = {
  params: { sessaoId: string };
};

export const metadata = {
  title: 'Sessão executada — AMFIT',
};

export default function MinhaSessaoDetalhePage({ params }: Props) {
  return (
    <div className="max-w-5xl">
      <MinhaSessaoDetalhe sessaoId={params.sessaoId} />
    </div>
  );
}
