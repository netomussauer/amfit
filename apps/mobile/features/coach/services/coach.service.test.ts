import { apiRequest } from '@/shared/lib/api-client';
import { coachService } from './coach.service';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const videoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  aluno_id: '22222222-2222-2222-2222-222222222222',
  video_url: 'https://minio.local/coach-videos/x?presigned=1',
  duracao_segundos: 30,
  status: 'AGUARDANDO_FEEDBACK' as const,
  criado_em: '2026-09-05T10:00:00Z',
};

describe('coachService.enviarVideo', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('envia POST /coach/videos como multipart com os campos informados', async () => {
    mockedApiRequest.mockResolvedValue(videoFixture);

    const result = await coachService.enviarVideo({
      video: { uri: 'file:///video.mp4', mimeType: 'video/mp4', fileName: 'video.mp4' },
      duracaoSegundos: 30,
      descricao: 'confere minha postura',
    });

    expect(mockedApiRequest).toHaveBeenCalledWith('/coach/videos', {
      method: 'POST',
      body: expect.any(FormData),
      isMultipart: true,
    });
    expect(result).toEqual(videoFixture);
  });

  it('lança erro quando a resposta não corresponde ao schema esperado', async () => {
    mockedApiRequest.mockResolvedValue({ ...videoFixture, duracao_segundos: 'nao-e-numero' });

    await expect(
      coachService.enviarVideo({
        video: { uri: 'file:///video.mp4', mimeType: 'video/mp4', fileName: 'video.mp4' },
        duracaoSegundos: 30,
      }),
    ).rejects.toThrow();
  });
});

describe('coachService.getMinhasVideos', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o endpoint /alunos/me/coach/videos repassando os params', async () => {
    const response = { data: [videoFixture], pagination: { total: 1, page: 1, per_page: 10 } };
    mockedApiRequest.mockResolvedValue(response);

    const params = { per_page: 10 };
    const result = await coachService.getMinhasVideos(params);

    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/coach/videos', { params });
    expect(result).toEqual(response);
  });
});
