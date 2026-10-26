import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIniciarSessao } from '@/features/execucao/hooks/useIniciarSessao';
import { makeTreino } from '@/features/execucao/test-utils/fixtures';
import { useMinhaFicha } from '../hooks/useMinhaFicha';
import { useTreinoHoje } from '../hooks/useTreinoHoje';
import { MeuTreinoHoje } from './MeuTreinoHoje';

vi.mock('../hooks/useTreinoHoje');
vi.mock('../hooks/useMinhaFicha');
vi.mock('@/features/execucao/hooks/useIniciarSessao');

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/features/exercicios/components/MidiaPreview', () => ({
  MidiaPreview: () => null,
}));

const mockedUseTreinoHoje = vi.mocked(useTreinoHoje);
const mockedUseMinhaFicha = vi.mocked(useMinhaFicha);
const mockedUseIniciarSessao = vi.mocked(useIniciarSessao);

const treinoRefetch = vi.fn();
const fichaRefetch = vi.fn();
const mutateAsync = vi.fn();

const treino = makeTreino({ id: 'treino-1', letra: 'A' });

function mockTreinoHoje(overrides: Record<string, unknown>) {
  mockedUseTreinoHoje.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: treinoRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useTreinoHoje>);
}

function mockFicha(overrides: Record<string, unknown>) {
  mockedUseMinhaFicha.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: fichaRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useMinhaFicha>);
}

function mockIniciar(overrides: Record<string, unknown> = {}) {
  mockedUseIniciarSessao.mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useIniciarSessao>);
}

describe('MeuTreinoHoje', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFicha({});
    mockIniciar();
  });

  it('sempre mostra o titulo da pagina', () => {
    mockTreinoHoje({ isLoading: true });

    render(<MeuTreinoHoje />);

    expect(screen.getByRole('heading', { name: 'Treino de hoje' })).toBeInTheDocument();
  });

  describe('treino de hoje', () => {
    it('mostra o skeleton e nenhum botao enquanto carrega', () => {
      mockTreinoHoje({ isLoading: true });

      render(<MeuTreinoHoje />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText('Treino A')).not.toBeInTheDocument();
    });

    it('mostra erro com retry quando a busca falha', () => {
      mockTreinoHoje({ isError: true });

      render(<MeuTreinoHoje />);

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar seu treino');
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(treinoRefetch).toHaveBeenCalledTimes(1);
    });

    it('mostra o card do treino e o botao "Iniciar treino"', () => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: null } });

      render(<MeuTreinoHoje />);

      expect(screen.getByText('Treino A')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Iniciar treino' })).toBeEnabled();
      expect(screen.queryByText('Você tem uma sessão em andamento')).not.toBeInTheDocument();
    });
  });

  describe('iniciar sessao', () => {
    it('cria a sessao com o treino de hoje e navega para ela', async () => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: null } });
      mutateAsync.mockResolvedValue({ id: 'sessao-nova' });

      render(<MeuTreinoHoje />);
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar treino' }));

      await waitFor(() => expect(push).toHaveBeenCalledWith('/treino/sessao-nova'));
      expect(mutateAsync).toHaveBeenCalledWith({ treino_id: 'treino-1' });
    });

    it('mostra o detail da API quando falha ao iniciar, sem navegar', async () => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: null } });
      mutateAsync.mockRejectedValue({ response: { data: { detail: 'Já existe sessão hoje.' } } });

      render(<MeuTreinoHoje />);
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar treino' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Já existe sessão hoje.');
      expect(push).not.toHaveBeenCalled();
    });

    it('usa mensagem generica quando o erro nao traz detail', async () => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: null } });
      mutateAsync.mockRejectedValue(new Error('rede'));

      render(<MeuTreinoHoje />);
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar treino' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível iniciar o treino.',
      );
    });

    it('mostra "Iniciando..." e desabilita o botao enquanto a mutacao roda', () => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: null } });
      mockIniciar({ isPending: true });

      render(<MeuTreinoHoje />);

      const botao = screen.getByRole('button', { name: 'Iniciando...' });
      expect(botao).toBeDisabled();
      expect(botao).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('sessao em andamento', () => {
    beforeEach(() => {
      mockTreinoHoje({ data: { treino, sessao_hoje_id: 'sessao-aberta' } });
    });

    it('troca o botao para "Continuar treino" com aviso', () => {
      render(<MeuTreinoHoje />);

      expect(screen.getByRole('button', { name: /Continuar treino/ })).toBeInTheDocument();
      expect(screen.getByText('Você tem uma sessão em andamento')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Iniciar treino' })).not.toBeInTheDocument();
    });

    it('navega para a sessao existente sem criar outra', () => {
      render(<MeuTreinoHoje />);

      fireEvent.click(screen.getByRole('button', { name: /Continuar treino/ }));

      expect(push).toHaveBeenCalledWith('/treino/sessao-aberta');
      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('sem treino hoje', () => {
    beforeEach(() => {
      mockTreinoHoje({ data: null });
    });

    it('mostra "Nenhuma ficha ativa" quando o aluno nao tem ficha', () => {
      mockFicha({ data: undefined });

      render(<MeuTreinoHoje />);

      expect(screen.getByText('Nenhuma ficha ativa')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /treino/i })).not.toBeInTheDocument();
    });

    it('mostra "Sem treino agendado" quando ha ficha ativa mas nenhum treino hoje', () => {
      mockFicha({ data: { id: 'ficha-1' } });

      render(<MeuTreinoHoje />);

      expect(screen.getByText('Sem treino agendado para hoje')).toBeInTheDocument();
    });

    it('mostra o skeleton enquanto a ficha carrega', () => {
      mockFicha({ isLoading: true });

      render(<MeuTreinoHoje />);

      expect(screen.queryByText('Nenhuma ficha ativa')).not.toBeInTheDocument();
      expect(screen.queryByText('Sem treino agendado para hoje')).not.toBeInTheDocument();
    });

    it('trata 404 da ficha como "sem ficha", nao como erro', () => {
      mockFicha({ isError: true, error: { response: { status: 404 } } });

      render(<MeuTreinoHoje />);

      expect(screen.getByText('Nenhuma ficha ativa')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('mostra erro com retry da ficha para falhas diferentes de 404', () => {
      mockFicha({ isError: true, error: { response: { status: 500 } } });

      render(<MeuTreinoHoje />);

      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar seu treino');
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(fichaRefetch).toHaveBeenCalledTimes(1);
      expect(treinoRefetch).not.toHaveBeenCalled();
    });
  });
});
