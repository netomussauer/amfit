import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaResponse } from '@amfit/shared';
import { useFicha } from '../hooks/useFicha';
import { useCriarTreino } from '../hooks/useCriarTreino';
import { useDesativarFicha } from '../hooks/useDesativarFicha';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { FichaBuilder } from './FichaBuilder';

polyfillDialogElement();

vi.mock('../hooks/useFicha');
vi.mock('../hooks/useCriarTreino');
vi.mock('../hooks/useDesativarFicha');

// Isola o teste da renderizacao real de cada treino e do form de metadata —
// cobertos separadamente em TreinoCard.test.tsx e FichaForm.test.tsx.
vi.mock('./TreinoCard', () => ({
  TreinoCard: ({ treino }: { treino: { id: string; letra: string } }) => (
    <div data-testid={`treino-card-${treino.id}`}>Treino {treino.letra}</div>
  ),
}));
vi.mock('./FichaForm', () => ({
  FichaForm: () => <div data-testid="ficha-form-mock" />,
}));

const mockedReplace = vi.fn();
const mockedRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockedReplace,
    refresh: mockedRefresh,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseFicha = vi.mocked(useFicha);
const mockedUseCriarTreino = vi.mocked(useCriarTreino);
const mockedUseDesativarFicha = vi.mocked(useDesativarFicha);

function mockUseFichaReturn(overrides: Partial<ReturnType<typeof useFicha>>) {
  mockedUseFicha.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useFicha>);
}

function mockUseCriarTreinoReturn(overrides: Partial<ReturnType<typeof useCriarTreino>>) {
  mockedUseCriarTreino.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarTreino>);
}

function mockUseDesativarFichaReturn(overrides: Partial<ReturnType<typeof useDesativarFicha>>) {
  mockedUseDesativarFicha.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useDesativarFicha>);
}

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  vigencia_fim: '2026-08-01',
  ativa: true,
  treinos: [
    { id: 'treino-b', letra: 'B', ordem: 1, itens: [] },
    { id: 'treino-a', letra: 'A', ordem: 0, itens: [] },
  ],
};

describe('FichaBuilder', () => {
  beforeEach(() => {
    mockedUseFicha.mockReset();
    mockedUseCriarTreino.mockReset();
    mockedUseDesativarFicha.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockUseCriarTreinoReturn({});
    mockUseDesativarFichaReturn({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseFichaReturn({ isLoading: true });

    render(<FichaBuilder fichaId="ficha-1" />);

    expect(screen.getByText('Carregando ficha...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseFichaReturn({ isError: true, refetch });

    render(<FichaBuilder fichaId="ficha-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar esta ficha.');

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renderiza titulo, vigencia e os treinos ordenados por "ordem"', () => {
    mockUseFichaReturn({ data: fichaFixture });

    render(<FichaBuilder fichaId="ficha-1" />);

    expect(screen.getByRole('heading', { name: 'Hipertrofia — Maio/2026' })).toBeInTheDocument();
    expect(screen.getByText(/01\/05\/2026 — 01\/08\/2026/)).toBeInTheDocument();

    const cards = screen.getAllByTestId(/treino-card-/);
    expect(cards.map((el) => el.textContent)).toEqual(['Treino A', 'Treino B']);
  });

  it('exibe estado vazio quando a ficha nao tem treinos', () => {
    mockUseFichaReturn({ data: { ...fichaFixture, treinos: [] } });

    render(<FichaBuilder fichaId="ficha-1" />);

    expect(screen.getByText('Esta ficha ainda não tem treinos.')).toBeInTheDocument();
  });

  it('adiciona um treino com a proxima letra e ordem disponiveis', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseFichaReturn({ data: fichaFixture });
    mockUseCriarTreinoReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /adicionar treino/i }));

    expect(mutate).toHaveBeenCalledWith(
      { fichaId: 'ficha-1', payload: { letra: 'C', ordem: 2 } },
      expect.anything(),
    );
  });

  it('usa letra "A" e ordem 0 ao adicionar o primeiro treino de uma ficha vazia', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseFichaReturn({ data: { ...fichaFixture, treinos: [] } });
    mockUseCriarTreinoReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /adicionar treino/i }));

    expect(mutate).toHaveBeenCalledWith(
      { fichaId: 'ficha-1', payload: { letra: 'A', ordem: 0 } },
      expect.anything(),
    );
  });

  it('exibe mensagem de erro na acao quando adicionar treino falha', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onError());
    mockUseFichaReturn({ data: fichaFixture });
    mockUseCriarTreinoReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /adicionar treino/i }));

    expect(
      screen.getByText('Não foi possível adicionar o treino. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('exibe o botao de desativar apenas quando a ficha esta ativa', () => {
    mockUseFichaReturn({ data: { ...fichaFixture, ativa: false } });

    render(<FichaBuilder fichaId="ficha-1" />);

    expect(screen.getByText('Inativa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desativar ficha/i })).not.toBeInTheDocument();
  });

  it('nao desativa quando o usuario cancela a confirmacao', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const mutate = vi.fn();
    mockUseFichaReturn({ data: fichaFixture });
    mockUseDesativarFichaReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /desativar ficha/i }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('desativa a ficha e navega para a pagina do aluno ao confirmar', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_id, opts) => opts.onSuccess());
    mockUseFichaReturn({ data: fichaFixture });
    mockUseDesativarFichaReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /desativar ficha/i }));

    expect(mutate).toHaveBeenCalledWith('ficha-1', expect.anything());
    expect(mockedReplace).toHaveBeenCalledWith('/alunos/aluno-1');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro na acao quando desativar a ficha falha', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_id, opts) => opts.onError());
    mockUseFichaReturn({ data: fichaFixture });
    mockUseDesativarFichaReturn({ mutate });

    render(<FichaBuilder fichaId="ficha-1" />);

    await user.click(screen.getByRole('button', { name: /desativar ficha/i }));

    expect(
      screen.getByText('Não foi possível desativar a ficha. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('abre o modal de edicao de metadata ao clicar em "Editar metadata"', async () => {
    const user = userEvent.setup();
    mockUseFichaReturn({ data: fichaFixture });

    const { container } = render(<FichaBuilder fichaId="ficha-1" />);

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: /editar metadata/i }));

    expect(container.querySelector('dialog')).toHaveAttribute('open');
    expect(screen.getByTestId('ficha-form-mock')).toBeInTheDocument();
  });
});
