import { beforeEach, describe, expect, it, vi } from 'vitest';
import { coachService } from './coach.service';

const { mockedGet, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost },
}));

const videoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  aluno_id: '22222222-2222-2222-2222-222222222222',
  aluno_nome: 'João Silva',
  video_url: 'https://minio.local/coach-videos/abc?presigned=1',
  duracao_segundos: 45,
  status: 'AGUARDANDO_FEEDBACK' as const,
  criado_em: '2026-09-05T10:00:00Z',
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

describe('coachService.listVideos', () => {
  it('busca /coach/videos com page/per_page, omitindo status quando nao informado', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [videoFixture], pagination: { total: 1, page: 1, per_page: 20 } },
    });

    await coachService.listVideos({ page: 1, perPage: 20 });

    expect(mockedGet).toHaveBeenCalledWith('/coach/videos', {
      params: { page: 1, per_page: 20 },
    });
  });

  it('inclui status na query quando informado', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });

    await coachService.listVideos({ page: 1, perPage: 20, status: 'FEEDBACK_ENVIADO' });

    expect(mockedGet).toHaveBeenCalledWith('/coach/videos', {
      params: { page: 1, per_page: 20, status: 'FEEDBACK_ENVIADO' },
    });
  });
});

describe('coachService.getVideo', () => {
  it('busca /coach/videos/:id', async () => {
    mockedGet.mockResolvedValueOnce({ data: videoFixture });

    const resultado = await coachService.getVideo(videoFixture.id);

    expect(mockedGet).toHaveBeenCalledWith(`/coach/videos/${videoFixture.id}`);
    expect(resultado).toEqual(videoFixture);
  });

  it('lanca erro de validacao quando a resposta nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...videoFixture, duracao_segundos: 'x' } });

    await expect(coachService.getVideo(videoFixture.id)).rejects.toThrow();
  });
});

describe('coachService.enviarFeedback', () => {
  it('envia POST /coach/videos/:id/feedback', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { ...videoFixture, status: 'FEEDBACK_ENVIADO', feedback: { texto: 'boa execução', enviado_em: '2026-09-05T11:00:00Z' } },
    });

    await coachService.enviarFeedback(videoFixture.id, { texto: 'boa execução' });

    expect(mockedPost).toHaveBeenCalledWith(`/coach/videos/${videoFixture.id}/feedback`, {
      texto: 'boa execução',
    });
  });
});
