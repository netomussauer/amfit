import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { PlanoResponse } from '@amfit/shared';
import { usePlanoAluno } from '../hooks/usePlanoAluno';
import { PlanoSection } from './PlanoSection';

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

vi.mock('../hooks/usePlanoAluno');

// Isola do formulario real (coberto separadamente em PlanoForm.test.tsx).
vi.mock('./PlanoForm', () => ({
  PlanoForm: ({ onSuccess, onCancel }: { onSuccess: (r: unknown) => void; onCancel: () => void }) => (
    <div data-testid="plano-form-mock">
      <button type="button" onClick={() => onSuccess(planoFixture)}>
        submit-mock
      </button>
      <button type="button" onClick={onCancel}>
        cancel-mock
      </button>
    </div>
  ),
}));

const mockedUsePlanoAluno = vi.mocked(usePlanoAluno);

function mockUsePlanoAlunoReturn(overrides: Partial<ReturnType<typeof usePlanoAluno>>) {
  mockedUsePlanoAluno.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof usePlanoAluno>);
}

const planoFixture: PlanoResponse = {
  id: 'plano-1',
  aluno_id: 'aluno-1',
  valor_mensal: 200,
  dia_vencimento: 10,
  vigencia_inicio: '2026-01-01',
  status: 'ATIVO',
  criado_em: '2026-01-01T10:00:00Z',
  atualizado_em: '2026-01-01T10:00:00Z',
};

describe('PlanoSection', () => {
  beforeEach(() => {
    mockedUsePlanoAluno.mockReset();
  });

  it('exibe skeleton enquanto carrega', () => {
    mockUsePlanoAlunoReturn({ isLoading: true });

    const { container } = render(<PlanoSection alunoId="aluno-1" />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha por um motivo inesperado', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUsePlanoAlunoReturn({ isError: true, error: makeAxiosError(500), refetch });

    render(<PlanoSection alunoId="aluno-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o plano.');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe o CTA de configurar quando o aluno ainda nao tem plano (404)', async () => {
    const user = userEvent.setup();
    mockUsePlanoAlunoReturn({ isError: true, error: makeAxiosError(404) });

    render(<PlanoSection alunoId="aluno-1" />);

    expect(screen.getByText('Este aluno ainda não tem um plano configurado.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /configurar plano/i }));
    expect(screen.getByTestId('plano-form-mock')).toBeInTheDocument();
  });

  it('mostra o resumo do plano quando ele já existe', () => {
    mockUsePlanoAlunoReturn({ data: planoFixture });

    render(<PlanoSection alunoId="aluno-1" />);

    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(screen.getByText(/dia 10/)).toBeInTheDocument();
  });

  it('abre o formulario de edicao ao clicar em editar plano', async () => {
    const user = userEvent.setup();
    mockUsePlanoAlunoReturn({ data: planoFixture });

    render(<PlanoSection alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /editar plano/i }));
    expect(screen.getByTestId('plano-form-mock')).toBeInTheDocument();
  });

  it('mostra o resumo atualizado logo apos salvar (nao depende de um novo GET)', async () => {
    const user = userEvent.setup();
    mockUsePlanoAlunoReturn({ isError: true, error: makeAxiosError(404) });

    render(<PlanoSection alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /configurar plano/i }));
    await user.click(screen.getByText('submit-mock'));

    expect(screen.getByText(/200/)).toBeInTheDocument();
  });
});
