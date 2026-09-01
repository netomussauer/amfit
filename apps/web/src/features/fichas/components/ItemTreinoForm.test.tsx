import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ExercicioResponse, ItemTreinoResponse } from '@amfit/shared';
import { useCriarItem } from '../hooks/useCriarItem';
import { useAtualizarItem } from '../hooks/useAtualizarItem';
import { ItemTreinoForm } from './ItemTreinoForm';

vi.mock('../hooks/useCriarItem');
vi.mock('../hooks/useAtualizarItem');

// MidiaPreview pertence a features/exercicios (fora do escopo desta tarefa)
// — mock simples so pra nao depender do componente real de outra feature.
vi.mock('@/features/exercicios/components/MidiaPreview', () => ({
  MidiaPreview: ({ alt }: { alt: string }) => (
    <div data-testid="midia-preview-mock">Mídia: {alt}</div>
  ),
}));

const exercicioFixture: ExercicioResponse = {
  id: '55555555-5555-5555-5555-555555555555',
  nome: 'Supino reto',
  grupo_muscular: { id: '66666666-6666-6666-6666-666666666666', nome: 'Peito' },
  is_global: true,
};

// Isola o teste da renderizacao real do seletor de exercicios — coberto
// separadamente em ExercicioSelector.test.tsx.
vi.mock('./ExercicioSelector', () => ({
  ExercicioSelector: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (ex: ExercicioResponse) => void;
  }) =>
    open ? (
      <div data-testid="exercicio-selector-mock">
        <button type="button" onClick={() => onSelect(exercicioFixture)}>
          Selecionar mock
        </button>
      </div>
    ) : null,
}));

const mockedUseCriarItem = vi.mocked(useCriarItem);
const mockedUseAtualizarItem = vi.mocked(useAtualizarItem);

function mockUseCriarItemReturn(overrides: Partial<ReturnType<typeof useCriarItem>>) {
  mockedUseCriarItem.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarItem>);
}

function mockUseAtualizarItemReturn(overrides: Partial<ReturnType<typeof useAtualizarItem>>) {
  mockedUseAtualizarItem.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarItem>);
}

function makeAxiosError(status: number, data: unknown) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('ItemTreinoForm — modo create', () => {
  beforeEach(() => {
    mockedUseCriarItem.mockReset();
    mockedUseAtualizarItem.mockReset();
    mockUseCriarItemReturn({});
  });

  const baseProps = {
    mode: 'create' as const,
    fichaId: 'ficha-1',
    treinoId: 'treino-1',
    ordem: 2,
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renderiza os valores padrao de series e repeticoes e nenhum exercicio selecionado', () => {
    render(<ItemTreinoForm {...baseProps} />);

    expect(screen.getByRole('button', { name: /selecionar exercício/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/séries/i)).toHaveValue(3);
    expect(screen.getByLabelText(/repetições/i)).toHaveValue('8-12');
  });

  it('bloqueia o submit quando nenhum exercicio foi selecionado (validado pelo schema)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseCriarItemReturn({ mutate });

    render(<ItemTreinoForm {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /adicionar exercício/i }));

    expect(mutate).not.toHaveBeenCalled();
    // O zodResolver (CriarItemTreinoRequestSchema.exercicio_id.uuid(...)) já
    // bloqueia o submit antes do handleSubmit interno rodar — o check manual
    // `if (!exercicio) setExercicioError(...)` dentro de onSubmit fica
    // inalcançável neste fluxo (nunca chega a exibir "Selecione um
    // exercício antes de salvar."). Ver achado no relatório da tarefa.
    expect(screen.getByText('Selecione um exercício')).toBeInTheDocument();
  });

  it('seleciona o exercicio via seletor, envia o payload e chama onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const mutate = vi.fn((_vars, opts) => opts.onSuccess());
    mockUseCriarItemReturn({ mutate });

    render(<ItemTreinoForm {...baseProps} onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: /selecionar exercício/i }));
    await user.click(screen.getByRole('button', { name: /selecionar mock/i }));

    expect(screen.getByText('Supino reto')).toBeInTheDocument();
    expect(screen.queryByTestId('exercicio-selector-mock')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adicionar exercício/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars).toEqual({
      fichaId: 'ficha-1',
      treinoId: 'treino-1',
      payload: expect.objectContaining({
        exercicio_id: exercicioFixture.id,
        ordem: 2,
        series: 3,
        repeticoes: '8-12',
      }),
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('permite limpar o exercicio selecionado, voltando ao placeholder', async () => {
    const user = userEvent.setup();
    mockUseCriarItemReturn({});

    render(<ItemTreinoForm {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /selecionar exercício/i }));
    await user.click(screen.getByRole('button', { name: /selecionar mock/i }));
    expect(screen.getByText('Supino reto')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /limpar/i }));

    expect(screen.queryByText('Supino reto')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /selecionar exercício/i })).toBeInTheDocument();
  });

  it('exibe mensagem de erro de validacao quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onError(makeAxiosError(422, {})));
    mockUseCriarItemReturn({ mutate });

    render(<ItemTreinoForm {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /selecionar exercício/i }));
    await user.click(screen.getByRole('button', { name: /selecionar mock/i }));
    await user.click(screen.getByRole('button', { name: /adicionar exercício/i }));

    expect(screen.getByText('Há campos inválidos. Revise e tente novamente.')).toBeInTheDocument();
  });

  it('chama onCancel ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<ItemTreinoForm {...baseProps} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ItemTreinoForm — modo edit', () => {
  const itemFixture: ItemTreinoResponse = {
    id: 'item-1',
    ordem: 0,
    exercicio: exercicioFixture,
    series: 4,
    repeticoes: '6-10',
    carga_sugerida: 20,
    descanso_segundos: 60,
    observacao: 'Cadência controlada',
  };

  beforeEach(() => {
    mockedUseCriarItem.mockReset();
    mockedUseAtualizarItem.mockReset();
    mockUseAtualizarItemReturn({});
  });

  it('renderiza o exercicio em modo somente leitura (sem trocar/limpar) e os valores preenchidos', () => {
    render(
      <ItemTreinoForm
        mode="edit"
        fichaId="ficha-1"
        item={itemFixture}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Supino reto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /trocar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /limpar/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/séries/i)).toHaveValue(4);
    expect(screen.getByLabelText(/repetições/i)).toHaveValue('6-10');
    expect(screen.getByLabelText(/observação/i)).toHaveValue('Cadência controlada');
  });

  it('mantem o submit desabilitado ate o formulario ser alterado', () => {
    render(
      <ItemTreinoForm
        mode="edit"
        fichaId="ficha-1"
        item={itemFixture}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('submete o payload atualizado e chama onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const mutate = vi.fn((_vars, opts) => opts.onSuccess());
    mockUseAtualizarItemReturn({ mutate });

    render(
      <ItemTreinoForm
        mode="edit"
        fichaId="ficha-1"
        item={itemFixture}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/séries/i));
    await user.type(screen.getByLabelText(/séries/i), '5');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.fichaId).toBe('ficha-1');
    expect(vars.itemId).toBe('item-1');
    expect(vars.payload).toMatchObject({ series: 5 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro de validacao quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onError(makeAxiosError(422, {})));
    mockUseAtualizarItemReturn({ mutate });

    render(
      <ItemTreinoForm
        mode="edit"
        fichaId="ficha-1"
        item={itemFixture}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/séries/i));
    await user.type(screen.getByLabelText(/séries/i), '5');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(screen.getByText('Há campos inválidos. Revise e tente novamente.')).toBeInTheDocument();
  });
});
