import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreinoResponse } from '@amfit/shared';
import { useAtualizarTreino } from '../hooks/useAtualizarTreino';
import { useRemoverTreino } from '../hooks/useRemoverTreino';
import { useReordenarItens } from '../hooks/useReordenarItens';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { TreinoCard } from './TreinoCard';

polyfillDialogElement();

vi.mock('../hooks/useAtualizarTreino');
vi.mock('../hooks/useRemoverTreino');
vi.mock('../hooks/useReordenarItens');

// Isola o teste da renderizacao real das linhas de item e do form de
// adicionar exercicio — cobertos separadamente em ItemTreinoRow.test.tsx e
// ItemTreinoForm.test.tsx. O mock inclui botoes minimos de "Subir"/"Descer"
// para exercitar o `handleMove` (calculo de reordenacao) que vive no
// TreinoCard — a UI real desses botoes (icones, estado disabled) e testada
// isoladamente em ItemTreinoRow.test.tsx.
vi.mock('./ItemTreinoRow', () => ({
  ItemTreinoRow: ({
    item,
    onMoveUp,
    onMoveDown,
  }: {
    item: { id: string; exercicio: { nome: string } };
    onMoveUp: () => void;
    onMoveDown: () => void;
  }) => (
    <li data-testid={`item-row-${item.id}`}>
      {item.exercicio.nome}
      <button type="button" onClick={onMoveUp}>
        Subir
      </button>
      <button type="button" onClick={onMoveDown}>
        Descer
      </button>
    </li>
  ),
}));
vi.mock('./ItemTreinoForm', () => ({
  ItemTreinoForm: () => <div data-testid="item-treino-form-mock" />,
}));

const mockedUseAtualizarTreino = vi.mocked(useAtualizarTreino);
const mockedUseRemoverTreino = vi.mocked(useRemoverTreino);
const mockedUseReordenarItens = vi.mocked(useReordenarItens);

function mockUseAtualizarTreinoReturn(overrides: Partial<ReturnType<typeof useAtualizarTreino>>) {
  mockedUseAtualizarTreino.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarTreino>);
}

function mockUseRemoverTreinoReturn(overrides: Partial<ReturnType<typeof useRemoverTreino>>) {
  mockedUseRemoverTreino.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRemoverTreino>);
}

function mockUseReordenarItensReturn(overrides: Partial<ReturnType<typeof useReordenarItens>>) {
  mockedUseReordenarItens.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useReordenarItens>);
}

function makeExercicio(id: string, nome: string) {
  return {
    id,
    nome,
    grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
    is_global: true,
  };
}

const treinoFixture: TreinoResponse = {
  id: 'treino-1',
  letra: 'A',
  ordem: 0,
  itens: [
    {
      id: 'item-1',
      ordem: 0,
      exercicio: makeExercicio('ex-1', 'Supino reto'),
      series: 3,
      repeticoes: '8-12',
    },
    {
      id: 'item-2',
      ordem: 1,
      exercicio: makeExercicio('ex-2', 'Crucifixo'),
      series: 3,
      repeticoes: '10-15',
    },
  ],
};

describe('TreinoCard', () => {
  beforeEach(() => {
    mockedUseAtualizarTreino.mockReset();
    mockedUseRemoverTreino.mockReset();
    mockedUseReordenarItens.mockReset();
    mockUseAtualizarTreinoReturn({});
    mockUseRemoverTreinoReturn({});
    mockUseReordenarItensReturn({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renderiza o cabecalho do treino e uma linha por item', () => {
    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);

    expect(screen.getByRole('heading', { name: 'Treino A' })).toBeInTheDocument();
    expect(screen.getByTestId('item-row-item-1')).toHaveTextContent('Supino reto');
    expect(screen.getByTestId('item-row-item-2')).toHaveTextContent('Crucifixo');
  });

  it('exibe estado vazio quando o treino nao tem itens', () => {
    render(
      <TreinoCard
        fichaId="ficha-1"
        alunoId="aluno-1"
        treino={{ ...treinoFixture, itens: [] }}
      />,
    );

    expect(screen.getByText('Nenhum exercício neste treino ainda.')).toBeInTheDocument();
  });

  it('exibe o nome do treino quando preenchido, ou o placeholder quando ausente', () => {
    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);
    expect(screen.getByText('Adicionar nome (opcional)')).toBeInTheDocument();

    render(
      <TreinoCard
        fichaId="ficha-1"
        alunoId="aluno-1"
        treino={{ ...treinoFixture, nome: 'Peito e tríceps' }}
      />,
    );
    expect(screen.getByText('Peito e tríceps')).toBeInTheDocument();
  });

  it('permite editar e salvar o nome do treino', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onSuccess());
    mockUseAtualizarTreinoReturn({ mutate });

    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);

    await user.click(screen.getByText('Adicionar nome (opcional)'));
    const input = screen.getByLabelText('Nome do treino A');
    await user.type(input, 'Peito e tríceps');
    await user.click(screen.getByRole('button', { name: /salvar nome/i }));

    expect(mutate).toHaveBeenCalledWith(
      {
        fichaId: 'ficha-1',
        treinoId: 'treino-1',
        payload: { nome: 'Peito e tríceps' },
      },
      expect.anything(),
    );
  });

  it('cancela a edicao do nome restaurando o valor original', async () => {
    const user = userEvent.setup();

    render(
      <TreinoCard
        fichaId="ficha-1"
        alunoId="aluno-1"
        treino={{ ...treinoFixture, nome: 'Nome original' }}
      />,
    );

    await user.click(screen.getByText('Nome original'));
    const input = screen.getByLabelText('Nome do treino A');
    await user.clear(input);
    await user.type(input, 'Rascunho descartado');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByText('Nome original')).toBeInTheDocument();
  });

  it('abre o menu de opcoes e remove o treino apos confirmacao', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseRemoverTreinoReturn({ mutate });

    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);

    await user.click(screen.getByRole('button', { name: /mais opções/i }));
    await user.click(screen.getByRole('menuitem', { name: /remover treino/i }));

    expect(mutate).toHaveBeenCalledWith(
      { fichaId: 'ficha-1', treinoId: 'treino-1' },
      expect.anything(),
    );
  });

  it('nao remove o treino quando o usuario cancela a confirmacao', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const mutate = vi.fn();
    mockUseRemoverTreinoReturn({ mutate });

    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);

    await user.click(screen.getByRole('button', { name: /mais opções/i }));
    await user.click(screen.getByRole('menuitem', { name: /remover treino/i }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('reordena ao mover um item para cima, invertendo a posicao com o anterior', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseReordenarItensReturn({ mutate });

    render(<TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />);

    const subirButtons = screen.getAllByRole('button', { name: /^subir$/i });
    // segundo item ("Crucifixo") sobe uma posicao
    await user.click(subirButtons[1]);

    expect(mutate).toHaveBeenCalledWith(
      { fichaId: 'ficha-1', treinoId: 'treino-1', ids: ['item-2', 'item-1'] },
      expect.anything(),
    );
  });

  it('abre o modal de adicionar exercicio (dialog nativo) ao clicar em "Adicionar exercício"', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <TreinoCard fichaId="ficha-1" alunoId="aluno-1" treino={treinoFixture} />,
    );

    // O `<dialog>` e o form (mockado) ja existem na arvore desde o inicio —
    // o Modal so alterna o estado nativo `open` via showModal()/close(),
    // nao desmonta os children. O que muda com o clique e o atributo
    // `open` do elemento <dialog>.
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: /adicionar exercício/i }));

    expect(container.querySelector('dialog')).toHaveAttribute('open');
    expect(screen.getByTestId('item-treino-form-mock')).toBeInTheDocument();
  });
});
