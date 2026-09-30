'use client';

import { useMemo, useState } from 'react';
import { useExercicio } from '@/features/exercicios/hooks/useExercicio';
import {
  EvolucaoCargaView,
  calcularFrom,
  type RangeOption,
} from '@/features/progresso/components/EvolucaoCargaView';
import { buildEvolucaoCarga } from '@/features/progresso/lib/chart-data';
import { useMeuProgresso } from '../hooks/useMeuProgresso';

type Props = {
  exercicioId: string;
};

/**
 * Reusa `EvolucaoCargaView` de `features/progresso` (a versão do PERSONAL):
 * o shape de resposta (`HistoricoExercicioResponse`) é idêntico entre
 * GET /alunos/:id/progresso/exercicio/:id (PERSONAL) e
 * GET /alunos/me/progresso/exercicio/:id (ALUNO), e a parte visual
 * (gráfico, tabela, filtro de período) já é genérica — não depende de
 * alunoId nem de contexto de PERSONAL. O que muda é a busca de dados
 * (hook/service próprios desta feature) e o chrome ao redor (breadcrumb,
 * subtítulo, mensagem de erro).
 */
export function MeuProgressoExercicio({ exercicioId }: Props) {
  const [range, setRange] = useState<RangeOption>('90');

  const { data: exercicio } = useExercicio(exercicioId);

  const from = useMemo(() => calcularFrom(range), [range]);

  const {
    data: historico,
    isLoading,
    isError,
    refetch,
  } = useMeuProgresso({ exercicioId, from });

  const evolucao = useMemo(
    () => buildEvolucaoCarga(historico?.pontos ?? []),
    [historico],
  );

  return (
    <EvolucaoCargaView
      breadcrumb={[{ href: '/historico', label: 'Histórico' }]}
      titulo={exercicio?.nome ?? 'Evolução de carga'}
      subtitulo="Sua progressão de carga neste exercício."
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      isError={isError}
      mensagemErro="Não foi possível carregar seu histórico deste exercício."
      onRetry={() => refetch()}
      evolucao={evolucao}
    />
  );
}
