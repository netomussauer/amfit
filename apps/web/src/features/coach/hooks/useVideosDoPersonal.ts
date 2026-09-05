import { useQuery } from '@tanstack/react-query';
import type { CoachVideoListResponse } from '@amfit/shared';
import { coachService } from '../services/coach.service';
import { coachKeys, type CoachVideoListParams } from './query-keys';

export function useVideosDoPersonal(params: CoachVideoListParams) {
  return useQuery<CoachVideoListResponse>({
    queryKey: coachKeys.videoList(params),
    queryFn: () => coachService.listVideos(params),
    staleTime: 30 * 1000,
  });
}
