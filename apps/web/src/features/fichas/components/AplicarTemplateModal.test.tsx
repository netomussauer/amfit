import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AlunoListResponse, TemplateResponse } from '@amfit/shared';
import { useAlunos } from '@/features/alunos';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { useCriarFichaFromTemplate } from '../hooks/useCriarFichaFromTemplate';
import { AplicarTemplateModal } from './AplicarTemplateModal';

polyfillDialogElement();

vi.mock('@/features/alunos', () => ({
  useAlunos: vi.fn(),
}));
vi.mock('../hooks/useCriarFichaFromTemplate', () => ({
  useCriarFichaFromTemplate: vi.fn(),
}));

const mockedPush = vi.fn();
const mockedRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockedPush, refresh: mockedRefresh }),
}));

const mockedUseAlunos = vi.mocked(useAlunos);
const mockedUseCriarFichaFromTemplate = vi.mocked(useCriarFichaFromTemplate);

const alunosFixture: AlunoListResponse = {
  data: [
    {
      id: 'aluno-1',
      nome: 'Ana Silva',
      email: 'ana@ex.com',
      ativo: true,
      criado_em: '2026-01-01T00:00:00Z',
    },
    {
      id: 'aluno-2',
      nome: 'Bruno Souza',
      email: 'bruno@ex.com',
      ativo: true,
      criado_em: '2026-01-01T00:00:00Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 20 },
};

const templateFixture: TemplateResponse = {
  id: 'template-1',
  nome: 'Full Body (modelo)',
  nivel: 'INTERMEDIARIO',
  objetivo: 'hipertrofia',
  criado_por: 'PERSONAL',
  itens: [],
};

function mockAlunosReturn(overrides: Partial<ReturnType<typeof useAlunos>> = {}) {
  mockedUseAlunos.mockReturnValue({
    data: alunosFixture,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAlunos>);
}

function mockMutationReturn(overrides: Partial<ReturnType<typeof useCriarFichaFromTemplate>> = {}) {
  mockedUseCriarFichaFromTemplate.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarFichaFromTemplate>);
}

function makeAxiosError(status: number) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data: {},
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('AplicarTemplateModal', () => {
  beforeEach(() => {
    mockedUseAlunos.mockReset();
    mockedUseCriarFichaFromTemplate.mockReset();
    mockedPush.mockReset();
    mockedRefresh.mockReset();
    mockAlunosReturn();
    mockMutationReturn();
  });

  it('lista os alunos ativos como opções do seletor', () => {
    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'Ana Silva' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bruno Souza' })).toBeInTheDocument();
  });

  it('desabilita o botão Aplicar até um aluno ser selecionado', () => {
    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^aplicar$/i })).toBeDisabled();
  });

  it('aplica o template ao aluno selecionado e navega para a ficha criada', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onSuccess({ id: 'ficha-1' }));
    mockMutationReturn({ mutate });

    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /aluno/i }), 'aluno-2');
    await user.click(screen.getByRole('button', { name: /^aplicar$/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars).toMatchObject({ template_id: 'template-1', aluno_id: 'aluno-2' });
    expect(vars.vigencia_inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockedPush).toHaveBeenCalledWith('/alunos/aluno-2/fichas/ficha-1');
  });

  it('mostra erro quando o template nao tem itens (422)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts.onError(makeAxiosError(422)));
    mockMutationReturn({ mutate });

    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /aluno/i }), 'aluno-1');
    await user.click(screen.getByRole('button', { name: /^aplicar$/i }));

    expect(
      screen.getByText('Este template não tem itens e não pode ser aplicado.'),
    ).toBeInTheDocument();
  });

  it('chama onClose ao cancelar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AplicarTemplateModal template={templateFixture} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('busca alunos repassando o termo digitado (apos debounce) para o hook', async () => {
    const user = userEvent.setup();
    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/buscar aluno/i), 'Ana');

    await waitFor(() =>
      expect(mockedUseAlunos).toHaveBeenLastCalledWith(
        expect.objectContaining({ busca: 'Ana' }),
      ),
    );
  });

  it('avisa quando ha mais alunos do que a pagina atual mostra', () => {
    mockAlunosReturn({
      data: { ...alunosFixture, pagination: { total: 45, page: 1, per_page: 20 } },
    });

    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    expect(screen.getByText(/45 alunos encontrados/i)).toBeInTheDocument();
  });

  it('limpa o aluno selecionado ao mudar o termo de busca', async () => {
    const user = userEvent.setup();
    render(<AplicarTemplateModal template={templateFixture} onClose={vi.fn()} />);

    const select = screen.getByRole('combobox', { name: /aluno/i });
    await user.selectOptions(select, 'aluno-2');
    expect(select).toHaveValue('aluno-2');

    await user.type(screen.getByLabelText(/buscar aluno/i), 'A');

    expect(select).toHaveValue('');
  });
});
