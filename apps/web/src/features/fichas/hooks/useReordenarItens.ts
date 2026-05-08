import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { FichaResponse, TreinoResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  treinoId: string;
  ids: string[];
};

type Context = {
  previous: FichaResponse | undefined;
};

function reorderItens(
  ficha: FichaResponse,
  treinoId: string,
  ids: string[],
): FichaResponse {
  return {
    ...ficha,
    treinos: ficha.treinos.map((treino) => {
      if (treino.id !== treinoId) return treino;
      const byId = new Map(treino.itens.map((item) => [item.id, item]));
      const reordered = ids
        .map((id, index) => {
          const item = byId.get(id);
          return item ? { ...item, ordem: index } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      return { ...treino, itens: reordered };
    }),
  };
}

export function useReordenarItens() {
  const queryClient = useQueryClient();

  return useMutation<TreinoResponse, AxiosError, Variables, Context>({
    mutationFn: ({ treinoId, ids }) =>
      fichaService.reordenarItens(treinoId, { ids }),

    onMutate: async ({ fichaId, treinoId, ids }) => {
      await queryClient.cancelQueries({ queryKey: fichaKeys.detail(fichaId) });

      const previous = queryClient.getQueryData<FichaResponse>(
        fichaKeys.detail(fichaId),
      );

      if (previous) {
        queryClient.setQueryData<FichaResponse>(
          fichaKeys.detail(fichaId),
          reorderItens(previous, treinoId, ids),
        );
      }

      return { previous };
    },

    onError: (_err, { fichaId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(fichaKeys.detail(fichaId), context.previous);
      }
    },

    onSettled: (_data, _err, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
