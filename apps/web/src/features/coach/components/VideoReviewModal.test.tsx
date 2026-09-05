import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { CoachVideoResponse } from '@amfit/shared';
import { polyfillDialogElement } from '@/features/fichas/test-utils/polyfill-dialog';
import { useEnviarFeedback } from '../hooks/useEnviarFeedback';
import { VideoReviewModal } from './VideoReviewModal';

polyfillDialogElement();

vi.mock('../hooks/useEnviarFeedback');

const mockedUseEnviarFeedback = vi.mocked(useEnviarFeedback);

const videoSemFeedback: CoachVideoResponse = {
  id: 'video-1',
  aluno_id: 'aluno-1',
  aluno_nome: 'João Silva',
  exercicio_nome: 'Supino Reto',
  video_url: 'https://minio.local/coach-videos/x?presigned=1',
  duracao_segundos: 45,
  status: 'AGUARDANDO_FEEDBACK',
  descricao: 'Pode ver meu cotovelo?',
  criado_em: '2026-09-05T10:00:00Z',
};

const videoComFeedback: CoachVideoResponse = {
  ...videoSemFeedback,
  status: 'FEEDBACK_ENVIADO',
  feedback: { texto: 'Cotovelo ótimo, ajuste a pegada.', enviado_em: '2026-09-05T11:00:00Z' },
};

function mockMutationReturn(mutate: ReturnType<typeof vi.fn>) {
  mockedUseEnviarFeedback.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useEnviarFeedback>);
}

function makeConflictError() {
  const error = new AxiosError('Conflict');
  error.response = {
    status: 409,
    data: {},
    statusText: 'Conflict',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('VideoReviewModal', () => {
  beforeEach(() => {
    mockedUseEnviarFeedback.mockReset();
  });

  it('mostra o player, a descricao do aluno e o formulario de feedback quando ainda nao ha feedback', () => {
    mockMutationReturn(vi.fn());

    render(<VideoReviewModal video={videoSemFeedback} onClose={vi.fn()} />);

    expect(screen.getByText(/pode ver meu cotovelo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/feedback pro aluno/i)).toBeInTheDocument();
  });

  it('mostra o feedback ja enviado em vez do formulario', () => {
    mockMutationReturn(vi.fn());

    render(<VideoReviewModal video={videoComFeedback} onClose={vi.fn()} />);

    expect(screen.getByText('Cotovelo ótimo, ajuste a pegada.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/feedback pro aluno/i)).not.toBeInTheDocument();
  });

  it('envia o feedback e chama onClose ao ter sucesso', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const mutate = vi.fn((_vars, opts) => opts?.onSuccess?.());
    mockMutationReturn(mutate);

    render(<VideoReviewModal video={videoSemFeedback} onClose={onClose} />);

    await user.type(screen.getByLabelText(/feedback pro aluno/i), 'Boa execução!');
    await user.click(screen.getByRole('button', { name: /enviar feedback/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'video-1',
        payload: expect.objectContaining({ texto: 'Boa execução!' }),
      }),
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mostra mensagem de conflito quando o video ja tem feedback (409)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onError?.(makeConflictError()));
    mockMutationReturn(mutate);

    render(<VideoReviewModal video={videoSemFeedback} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/feedback pro aluno/i), 'Boa execução!');
    await user.click(screen.getByRole('button', { name: /enviar feedback/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('já recebeu feedback');
  });
});
