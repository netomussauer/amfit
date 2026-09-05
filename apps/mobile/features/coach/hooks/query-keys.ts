import type { MinhasVideosQueryParams } from '../services/coach.service';

export const coachKeys = {
  all: ['meu-coach'] as const,
  videos: (params?: MinhasVideosQueryParams) => [...coachKeys.all, 'videos', params ?? {}] as const,
};
