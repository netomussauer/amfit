import { AlunoDetalhe } from '@/features/alunos/components/AlunoDetalhe';
import { FichaList } from '@/features/fichas/components/FichaList';

type Props = {
  params: { id: string };
};

export const metadata = {
  title: 'Detalhe do aluno — AMFIT',
};

export default function AlunoDetalhePage({ params }: Props) {
  return (
    <div className="max-w-3xl space-y-10">
      <AlunoDetalhe alunoId={params.id} />
      <FichaList alunoId={params.id} />
    </div>
  );
}
