import { FichaBuilder } from '@/features/fichas/components/FichaBuilder';

type Props = {
  params: { id: string; fichaId: string };
};

export const metadata = {
  title: 'Ficha de treino — AMFIT',
};

export default function FichaBuilderPage({ params }: Props) {
  return (
    <div className="max-w-4xl">
      <FichaBuilder fichaId={params.fichaId} />
    </div>
  );
}
