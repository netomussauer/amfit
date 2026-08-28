import { ProgressoExercicio } from '@/features/progresso/components/ProgressoExercicio';

type Props = {
  params: { id: string; exercicioId: string };
};

export const metadata = {
  title: 'Evolução de carga — AMFIT',
};

export default function ProgressoExercicioPage({ params }: Props) {
  return (
    <div className="max-w-5xl">
      <ProgressoExercicio alunoId={params.id} exercicioId={params.exercicioId} />
    </div>
  );
}
