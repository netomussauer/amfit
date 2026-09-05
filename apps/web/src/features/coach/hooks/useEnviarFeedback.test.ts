import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { CoachVideoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { coachService } from '../services/coach.service';
import { coachKeys } from './query-keys';
import { useEnviarFeedback } from './useEnviarFeedback';

vi.mock('../services/coach.service', () => ({
  coachService: { enviarFeedback: vi.fn() },
}));

const mockedEnviarFeedback = vi.mocked(coachService.enviarFeedback);

const videoFixture: CoachVideoResponse = {
  id: 'video-1',
  aluno_id: 'aluno-1',
  video_url: 'https://minio.local/x',
  duracao_segundos: 30,
  status: 'FEEDBACK_ENVIADO',
  criado_em: '2026-09-05T10:00:00Z',
  feedback: { texto: 'boa execução', enviado_em: '2026-09-05T11:00:00Z' },
};

describe('useEnviarFeedback', () => {
  it('envia o feedback, grava no cache do video e invalida a lista', async () => {
    mockedEnviarFeedback.mockResolvedValueOnce(videoFixture);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useEnviarFeedback(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = { texto: 'boa execução' };
    result.current.mutate({ videoId: 'video-1', payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedEnviarFeedback).toHaveBeenCalledWith('video-1', payload);
    expect(setQueryDataSpy).toHaveBeenCalledWith(coachKeys.video('video-1'), videoFixture);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: coachKeys.videos() });
  });
});
