import {
  CoachVideoResponseSchema,
  CoachVideoListResponseSchema,
  type CoachVideoResponse,
  type CoachVideoListResponse,
  type EnviarFeedbackRequest,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { CoachVideoListParams } from '../hooks/query-keys';

export const coachService = {
  async listVideos(params: CoachVideoListParams): Promise<CoachVideoListResponse> {
    const query: Record<string, string | number> = {
      page: params.page,
      per_page: params.perPage,
    };
    if (params.status) query.status = params.status;

    const { data } = await apiClient.get('/coach/videos', { params: query });
    return CoachVideoListResponseSchema.parse(data);
  },

  async getVideo(id: string): Promise<CoachVideoResponse> {
    const { data } = await apiClient.get(`/coach/videos/${id}`);
    return CoachVideoResponseSchema.parse(data);
  },

  async enviarFeedback(id: string, payload: EnviarFeedbackRequest): Promise<CoachVideoResponse> {
    const { data } = await apiClient.post(`/coach/videos/${id}/feedback`, payload);
    return CoachVideoResponseSchema.parse(data);
  },
};
