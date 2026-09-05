import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useEnviarVideo } from './useEnviarVideo';
import { coachService } from '../services/coach.service';

jest.mock('../services/coach.service', () => ({
  coachService: { enviarVideo: jest.fn() },
}));

const mockedEnviarVideo = coachService.enviarVideo as jest.MockedFunction<
  typeof coachService.enviarVideo
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const videoFixture = {
  id: 'video-1',
  aluno_id: 'aluno-1',
  video_url: 'https://minio.local/x',
  duracao_segundos: 30,
  status: 'AGUARDANDO_FEEDBACK' as const,
  criado_em: '2026-09-05T10:00:00Z',
};

describe('useEnviarVideo', () => {
  beforeEach(() => {
    mockedEnviarVideo.mockReset();
  });

  it('envia o video com o input informado', async () => {
    mockedEnviarVideo.mockResolvedValue(videoFixture);
    const { result } = renderHook(() => useEnviarVideo(), { wrapper: createWrapper() });

    const input = {
      video: { uri: 'file:///a.mp4', mimeType: 'video/mp4', fileName: 'a.mp4' },
      duracaoSegundos: 30,
    };
    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedEnviarVideo).toHaveBeenCalledWith(input);
  });
});
