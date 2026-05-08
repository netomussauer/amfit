import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

export function useDesativarFicha() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => fichaService.deactivate(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: fichaKeys.lists() });
    },
  });
}
