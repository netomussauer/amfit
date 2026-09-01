import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemTreinoResponse } from '@amfit/shared';
import { useRemoverItem } from '../hooks/useRemoverItem';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { ItemTreinoRow } from './ItemTreinoRow';

polyfillDialogElement();

vi.mock('../hooks/useRemoverItem');

// MidiaPreview pertence a features/exercicios (fora do escopo desta tarefa).
vi.mock('@/features/exercicios/components/MidiaPreview', () => ({
  MidiaPreview: ({ alt }: { alt: string }) => (
    <div data-testid="midia-preview-mock">Mídia: {alt}</div>
  ),
}));

// Isola o teste do form real de edicao — coberto em ItemTreinoForm.test.tsx.
vi.mock('./ItemTreinoForm', () => ({
  ItemTreinoForm: () => <div data-testid="item-treino-form-mock" />,
}));

// next/link usa contexto do App Router (prefetch via useRouter) que nao
// existe fora de uma arvore Next real; substitui por um <a> simples,
// repassando aria-label/title (usados pelo link de "Ver evolução").
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockedUseRemoverItem = vi.mocked(useRemoverItem);

function mockUseRemoverItemReturn(overrides: Partial<ReturnType<typeof useRemoverItem>>) {
  mockedUseRemoverItem.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRemoverItem>);
}

const itemFixture: ItemTreinoResponse = {
  id: 'item-1',
  ordem: 0,
  exercicio: {
    id: 'ex-1',
    nome: 'Supino reto',
    grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
    is_global: true,
  },
  series: 3,
  repeticoes: '8-12',
  carga_sugerida: 40,
  descanso_segundos: 90,
  observacao: 'Foco na fase excêntrica',
};

const baseProps = {
  fichaId: 'ficha-1',
  alunoId: 'aluno-1',
  item: itemFixture,
  index: 1,
  totalItems: 3,
  isReordering: false,
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
};

describe('ItemTreinoRow', () => {
  beforeEach(() => {
    mockedUseRemoverItem.mockReset();
    mockUseRemoverItemReturn({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renderiza nome, series x repeticoes, carga e descanso do item', () => {
    render(<ItemTreinoRow {...baseProps} />);

    expect(screen.getByText('Supino reto')).toBeInTheDocument();
    expect(screen.getByText(/3 × 8-12/)).toBeInTheDocument();
    expect(screen.getByText(/40 kg/)).toBeInTheDocument();
    expect(screen.getByText(/descanso 90s/)).toBeInTheDocument();
    expect(screen.getByText('Foco na fase excêntrica')).toBeInTheDocument();
  });

  it('nao exibe observacao quando ausente', () => {
    render(<ItemTreinoRow {...baseProps} item={{ ...itemFixture, observacao: null }} />);

    expect(screen.queryByText('Foco na fase excêntrica')).not.toBeInTheDocument();
  });

  it('linka para a pagina de evolucao do exercicio do aluno', () => {
    render(<ItemTreinoRow {...baseProps} />);

    expect(screen.getByRole('link', { name: /ver evolução de supino reto/i })).toHaveAttribute(
      'href',
      '/alunos/aluno-1/progresso/ex-1',
    );
  });

  it('desabilita "Subir" no primeiro item e "Descer" no ultimo', () => {
    const { rerender } = render(<ItemTreinoRow {...baseProps} index={0} totalItems={3} />);
    expect(screen.getByRole('button', { name: 'Subir' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer' })).not.toBeDisabled();

    rerender(<ItemTreinoRow {...baseProps} index={2} totalItems={3} />);
    expect(screen.getByRole('button', { name: 'Subir' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer' })).toBeDisabled();
  });

  it('desabilita subir/descer enquanto isReordering e true', () => {
    render(<ItemTreinoRow {...baseProps} isReordering />);

    expect(screen.getByRole('button', { name: 'Subir' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer' })).toBeDisabled();
  });

  it('chama onMoveUp/onMoveDown ao clicar nos botoes correspondentes', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    render(<ItemTreinoRow {...baseProps} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />);

    await user.click(screen.getByRole('button', { name: 'Subir' }));
    await user.click(screen.getByRole('button', { name: 'Descer' }));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('abre o modal de edicao ao clicar em "Editar"', async () => {
    const user = userEvent.setup();
    const { container } = render(<ItemTreinoRow {...baseProps} />);

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(container.querySelector('dialog')).toHaveAttribute('open');
    expect(screen.getByTestId('item-treino-form-mock')).toBeInTheDocument();
  });

  it('remove o item apos confirmacao', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseRemoverItemReturn({ mutate });

    render(<ItemTreinoRow {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Remover' }));

    expect(mutate).toHaveBeenCalledWith(
      { fichaId: 'ficha-1', itemId: 'item-1' },
      expect.anything(),
    );
  });

  it('nao remove o item quando o usuario cancela a confirmacao', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const mutate = vi.fn();
    mockUseRemoverItemReturn({ mutate });

    render(<ItemTreinoRow {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Remover' }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('exibe mensagem de erro na acao quando a remocao falha', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onError());
    mockUseRemoverItemReturn({ mutate });

    render(<ItemTreinoRow {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Remover' }));

    expect(screen.getByText('Não foi possível remover este exercício.')).toBeInTheDocument();
  });
});
