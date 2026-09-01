import { MeuProgressoExercicio } from '@/features/meu-progresso/components/MeuProgressoExercicio';

type Props = {
  params: { exercicioId: string };
};

export const metadata = {
  title: 'Evolução de carga — AMFIT',
};

export default function MeuProgressoPage({ params }: Props) {
  return (
    <div className="max-w-5xl">
      <MeuProgressoExercicio exercicioId={params.exercicioId} />
    </div>
  );
}
