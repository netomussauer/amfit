import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachVideoListResponse } from '@amfit/shared';
import { useVideosDoPersonal } from '../hooks/useVideosDoPersonal';
import { CoachVideosList } from './CoachVideosList';

vi.mock('../hooks/useVideosDoPersonal');

// Isola do modal real (coberto separadamente em VideoReviewModal.test.tsx).
vi.mock('./VideoReviewModal', () => ({
  VideoReviewModal: ({ video, onClose }: { video: { aluno_nome?: string }; onClose: () => void }) => (
    <div data-testid="video-review-modal-mock">
      <span>{video.aluno_nome}</span>
      <button type="button" onClick={onClose}>
        fechar-mock
      </button>
    </div>
  ),
}));

const mockedUseVideosDoPersonal = vi.mocked(useVideosDoPersonal);

function mockUseVideosReturn(overrides: Partial<ReturnType<typeof useVideosDoPersonal>>) {
  mockedUseVideosDoPersonal.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useVideosDoPersonal>);
}

const videoFixture = {
  id: 'video-1',
  aluno_id: 'aluno-1',
  aluno_nome: 'João Silva',
  exercicio_nome: 'Supino Reto',
  video_url: 'https://minio.local/x',
  duracao_segundos: 45,
  status: 'AGUARDANDO_FEEDBACK' as const,
  descricao: 'Confere minha postura?',
  criado_em: '2026-09-05T10:00:00Z',
};

const listFixture: CoachVideoListResponse = {
  data: [videoFixture],
  pagination: { total: 1, page: 1, per_page: 20 },
};

describe('CoachVideosList', () => {
  beforeEach(() => {
    mockedUseVideosDoPersonal.mockReset();
  });

  it('exibe estado de carregamento', () => {
    mockUseVideosReturn({ isLoading: true });
    render(<CoachVideosList />);
    expect(screen.getByText(/carregando vídeos/i)).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseVideosReturn({ isError: true, refetch });

    render(<CoachVideosList />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio quando nao ha videos', () => {
    mockUseVideosReturn({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });
    render(<CoachVideosList />);
    expect(screen.getByText(/nenhum vídeo encontrado/i)).toBeInTheDocument();
  });

  it('mostra os videos retornados com nome do aluno e exercicio', () => {
    mockUseVideosReturn({ data: listFixture });
    render(<CoachVideosList />);

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Supino Reto')).toBeInTheDocument();
  });

  it('abre o modal de revisao ao clicar num video', async () => {
    const user = userEvent.setup();
    mockUseVideosReturn({ data: listFixture });
    render(<CoachVideosList />);

    await user.click(screen.getByText('João Silva'));
    expect(screen.getByTestId('video-review-modal-mock')).toBeInTheDocument();
  });

  it('filtra por status ao trocar o select', async () => {
    const user = userEvent.setup();
    mockUseVideosReturn({ data: listFixture });
    render(<CoachVideosList />);

    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), 'FEEDBACK_ENVIADO');

    expect(mockedUseVideosDoPersonal).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'FEEDBACK_ENVIADO', page: 1 }),
    );
  });
});
