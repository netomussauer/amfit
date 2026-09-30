'use client';

import { useMemo, useState } from 'react';
import { useAluno } from '@/features/alunos/hooks/useAluno';
import { useExercicio } from '@/features/exercicios/hooks/useExercicio';
import { useHistoricoExercicio } from '../hooks/useHistoricoExercicio';
import { buildEvolucaoCarga } from '../lib/chart-data';
import { EvolucaoCargaView, calcularFrom, type RangeOption } from './EvolucaoCargaView';

type Props = {
  alunoId: string;
  exercicioId: string;
};

export function ProgressoExercicio({ alunoId, exercicioId }: Props) {
  const [range, setRange] = useState<RangeOption>('90');

  const { data: aluno } = useAluno(alunoId);
  const { data: exercicio } = useExercicio(exercicioId);

  const from = useMemo(() => calcularFrom(range), [range]);

  const {
    data: historico,
    isLoading,
    isError,
    refetch,
  } = useHistoricoExercicio({ alunoId, exercicioId, from });

  const evolucao = useMemo(
    () => buildEvolucaoCarga(historico?.pontos ?? []),
    [historico],
  );

  return (
    <EvolucaoCargaView
      breadcrumb={[
        { href: '/alunos', label: 'Alunos' },
        { href: `/alunos/${alunoId}`, label: aluno?.nome ?? 'Aluno' },
      ]}
      titulo={exercicio?.nome ?? 'Evolução de carga'}
      subtitulo={`Progressão de carga de ${aluno?.nome ?? 'aluno'} neste exercício.`}
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      isError={isError}
      mensagemErro="Não foi possível carregar o histórico deste exercício."
      onRetry={() => refetch()}
      evolucao={evolucao}
    />
  );
}
