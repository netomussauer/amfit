import { AlunoDetalhe } from '@/features/alunos/components/AlunoDetalhe';

type Props = {
  params: { id: string };
};

export const metadata = {
  title: 'Detalhe do aluno — AMFIT',
};

export default function AlunoDetalhePage({ params }: Props) {
  return (
    <div className="max-w-3xl">
      <AlunoDetalhe alunoId={params.id} />
    </div>
  );
}
