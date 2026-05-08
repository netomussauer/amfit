import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RegistrarSerieRequest,
  RegistroSerieResponse,
  SessaoResponse,
} from '@amfit/shared';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';

type Context = {
  previous: SessaoResponse | undefined;
};

/**
 * Mutation para registrar/atualizar uma série da sessão.
 *
 * Optimistic update: o cache da sessão (`sessaoKeys.detail(sessaoId)`) é atualizado
 * antes da resposta do backend para que a UI reaja instantaneamente. Em caso de erro
 * o estado anterior é restaurado.
 *
 * O upsert no backend é por (sessao_id, item_treino_id, numero_serie), então
 * substituímos o registro existente quando bate a chave, ou anexamos um novo.
 */
export function useRegistrarSerie(sessaoId: string) {
  const queryClient = useQueryClient();
  const queryKey = sessaoKeys.detail(sessaoId);

  return useMutation<
    RegistroSerieResponse,
    Error,
    RegistrarSerieRequest,
    Context
  >({
    mutationFn: (body) => execucaoService.registrarSerie(sessaoId, body),

    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessaoResponse>(queryKey);

      if (previous) {
        const optimisticSerie: RegistroSerieResponse = {
          // ID temporário; será substituído pela resposta real no onSuccess.
          id: `optimistic-${body.item_treino_id}-${body.numero_serie}`,
          item_treino_id: body.item_treino_id,
          numero_serie: body.numero_serie,
          concluida: body.concluida,
          carga_realizada: body.carga_realizada ?? null,
          repeticoes_realizadas: body.repeticoes_realizadas ?? null,
          executado_em: new Date().toISOString(),
        };

        const idx = previous.series.findIndex(
          (s) =>
            s.item_treino_id === body.item_treino_id &&
            s.numero_serie === body.numero_serie,
        );

        const newSeries =
          idx >= 0
            ? previous.series.map((s, i) =>
                i === idx ? { ...s, ...optimisticSerie, id: s.id } : s,
              )
            : [...previous.series, optimisticSerie];

        queryClient.setQueryData<SessaoResponse>(queryKey, {
          ...previous,
          series: newSeries,
        });
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSuccess: (registro) => {
      // Substitui o registro otimista pelo retornado pelo backend (com ID real).
      const current = queryClient.getQueryData<SessaoResponse>(queryKey);
      if (!current) return;
      const idx = current.series.findIndex(
        (s) =>
          s.item_treino_id === registro.item_treino_id &&
          s.numero_serie === registro.numero_serie,
      );
      if (idx >= 0) {
        const newSeries = [...current.series];
        newSeries[idx] = registro;
        queryClient.setQueryData<SessaoResponse>(queryKey, {
          ...current,
          series: newSeries,
        });
      }
    },
  });
}
