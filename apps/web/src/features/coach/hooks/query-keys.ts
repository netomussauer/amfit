export type CoachVideoListParams = {
  status?: string;
  page: number;
  perPage: number;
};

export const coachKeys = {
  all: ['coach'] as const,
  videos: () => [...coachKeys.all, 'videos'] as const,
  videoList: (params: CoachVideoListParams) => [...coachKeys.videos(), params] as const,
  video: (id: string) => [...coachKeys.videos(), id] as const,
};
