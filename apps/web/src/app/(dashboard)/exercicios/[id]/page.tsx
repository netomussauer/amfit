import { ExercicioDetalhe } from '@/features/exercicios/components/ExercicioDetalhe';

type Props = {
  params: { id: string };
};

export const metadata = {
  title: 'Detalhe do exercício — AMFIT',
};

export default function ExercicioDetalhePage({ params }: Props) {
  return (
    <div className="max-w-3xl">
      <ExercicioDetalhe exercicioId={params.id} />
    </div>
  );
}
