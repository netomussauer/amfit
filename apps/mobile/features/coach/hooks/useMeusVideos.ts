import { useQuery } from '@tanstack/react-query';
import { coachService, type MinhasVideosQueryParams } from '../services/coach.service';
import { coachKeys } from './query-keys';

export function useMeusVideos(params?: MinhasVideosQueryParams) {
  return useQuery({
    queryKey: coachKeys.videos(params),
    queryFn: () => coachService.getMinhasVideos(params),
    staleTime: 30 * 1000,
  });
}
