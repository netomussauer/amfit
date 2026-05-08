import { useQuery } from '@tanstack/react-query';
import { execucaoService } from '../services/execucao.service';
import { minhasSessoesKeys } from './query-keys';

const DEFAULT_PER_PAGE = 20;

export function useMinhasSessoes(page: number = 1, perPage: number = DEFAULT_PER_PAGE) {
  return useQuery({
    queryKey: minhasSessoesKeys.list(page, perPage),
    queryFn: () => execucaoService.listarMinhasSessoes(page, perPage),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
