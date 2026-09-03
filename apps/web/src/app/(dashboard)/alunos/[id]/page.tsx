import Link from 'next/link';
import { AlunoDetalhe } from '@/features/alunos/components/AlunoDetalhe';
import { AnamneseSection } from '@/features/anamnese';
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
      <AnamneseSection alunoId={params.id} />
      <FichaList alunoId={params.id} />

      <div>
        <Link
          href={`/alunos/${params.id}/historico`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Ver histórico de sessões
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
