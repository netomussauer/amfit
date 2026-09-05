import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coachService, type EnviarVideoInput } from '../services/coach.service';
import { coachKeys } from './query-keys';

export function useEnviarVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EnviarVideoInput) => coachService.enviarVideo(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.all });
    },
  });
}
