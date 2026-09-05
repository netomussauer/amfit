import {
  CoachVideoResponseSchema,
  type CoachVideoResponse,
  CoachVideoListResponseSchema,
  type CoachVideoListResponse,
} from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export type VideoInput = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export type EnviarVideoInput = {
  video: VideoInput;
  duracaoSegundos: number;
  itemTreinoId?: string;
  descricao?: string;
};

export type MinhasVideosQueryParams = {
  page?: number;
  per_page?: number;
};

export const coachService = {
  /**
   * Envia o clipe do aluno pedindo revisão do personal. Espelha
   * POST /coach/videos (role=ALUNO).
   */
  async enviarVideo(input: EnviarVideoInput): Promise<CoachVideoResponse> {
    const fd = new FormData();
    // React Native FormData aceita objeto { uri, type, name } — diferente
    // do FormData web (mesmo padrão de exercicio.service.ts).
    fd.append('video', {
      uri: input.video.uri,
      type: input.video.mimeType,
      name: input.video.fileName,
    } as unknown as Blob);
    fd.append('duracao_segundos', String(input.duracaoSegundos));
    if (input.itemTreinoId) fd.append('item_treino_id', input.itemTreinoId);
    if (input.descricao) fd.append('descricao', input.descricao);

    const data = await apiRequest<CoachVideoResponse>('/coach/videos', {
      method: 'POST',
      body: fd,
      isMultipart: true,
    });
    return CoachVideoResponseSchema.parse(data);
  },

  /**
   * Vídeos do próprio aluno autenticado (role ALUNO). Espelha
   * GET /alunos/me/coach/videos.
   */
  async getMinhasVideos(params?: MinhasVideosQueryParams): Promise<CoachVideoListResponse> {
    const data = await apiRequest<CoachVideoListResponse>('/alunos/me/coach/videos', {
      params,
    });
    return CoachVideoListResponseSchema.parse(data);
  },
};
