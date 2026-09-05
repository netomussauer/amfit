import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CoachVideoResponse, EnviarFeedbackRequest } from '@amfit/shared';
import { coachService } from '../services/coach.service';
import { coachKeys } from './query-keys';

type Variables = {
  videoId: string;
  payload: EnviarFeedbackRequest;
};

export function useEnviarFeedback() {
  const queryClient = useQueryClient();

  return useMutation<CoachVideoResponse, AxiosError, Variables>({
    mutationFn: ({ videoId, payload }) => coachService.enviarFeedback(videoId, payload),
    onSuccess: (data, { videoId }) => {
      queryClient.setQueryData(coachKeys.video(videoId), data);
      queryClient.invalidateQueries({ queryKey: coachKeys.videos() });
    },
  });
}
