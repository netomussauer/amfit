import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { PlanoResponse } from '@amfit/shared';
import { useConfigurarPlano } from '../hooks/useConfigurarPlano';
import { useAtualizarPlano } from '../hooks/useAtualizarPlano';
import { PlanoForm } from './PlanoForm';

vi.mock('../hooks/useConfigurarPlano');
vi.mock('../hooks/useAtualizarPlano');

const mockedUseConfigurarPlano = vi.mocked(useConfigurarPlano);
const mockedUseAtualizarPlano = vi.mocked(useAtualizarPlano);

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

// Duas funções concretas (em vez de uma genérica sobre a união dos dois
// tipos de hook) — `vi.mocked(hook).mockReturnValue(...)` com `hook`
// tipado como união de duas assinaturas de UseMutationResult distintas
// confunde a inferência do TypeScript ("Two different types with this
// name exist, but they are unrelated").
function mockConfigurarPlano(mutate: ReturnType<typeof vi.fn>) {
  mockedUseConfigurarPlano.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useConfigurarPlano>);
}

function mockAtualizarPlano(mutate: ReturnType<typeof vi.fn>) {
  mockedUseAtualizarPlano.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useAtualizarPlano>);
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

describe('PlanoForm (criação)', () => {
  beforeEach(() => {
    mockedUseConfigurarPlano.mockReset();
    mockedUseAtualizarPlano.mockReset();
    mockAtualizarPlano(vi.fn());
  });

  it('envia os dados informados via useConfigurarPlano', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onSuccess?.(planoFixture));
    mockConfigurarPlano(mutate);

    const onSuccess = vi.fn();
    render(<PlanoForm alunoId="aluno-1" onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/valor mensal/i), '200');
    await user.type(screen.getByLabelText(/dia do vencimento/i), '10');
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        alunoId: 'aluno-1',
        payload: expect.objectContaining({ valor_mensal: 200, dia_vencimento: 10 }),
      }),
      expect.anything(),
    );
    expect(onSuccess).toHaveBeenCalledWith(planoFixture);
  });

  it('mostra mensagem de conflito quando o aluno ja tem plano ativo (409)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onError?.(makeConflictError()));
    mockConfigurarPlano(mutate);

    render(<PlanoForm alunoId="aluno-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/valor mensal/i), '200');
    await user.type(screen.getByLabelText(/dia do vencimento/i), '10');
    await user.click(screen.getByRole('button', { name: /salvar plano/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('já tem um plano ativo');
  });

  it('nao mostra o campo status no modo de criacao', () => {
    mockConfigurarPlano(vi.fn());
    render(<PlanoForm alunoId="aluno-1" onSuccess={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
  });

  it('chama onCancel ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    mockConfigurarPlano(vi.fn());
    const onCancel = vi.fn();

    render(<PlanoForm alunoId="aluno-1" onSuccess={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('PlanoForm (edição)', () => {
  beforeEach(() => {
    mockedUseConfigurarPlano.mockReset();
    mockedUseAtualizarPlano.mockReset();
    mockConfigurarPlano(vi.fn());
  });

  it('pré-preenche os campos com o plano existente e mostra o campo status', () => {
    mockAtualizarPlano(vi.fn());

    render(
      <PlanoForm
        alunoId="aluno-1"
        planoExistente={planoFixture}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/valor mensal/i)).toHaveValue(200);
    expect(screen.getByLabelText(/dia do vencimento/i)).toHaveValue(10);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('envia o patch via useAtualizarPlano com o id do plano existente', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onSuccess?.(planoFixture));
    mockAtualizarPlano(mutate);

    render(
      <PlanoForm
        alunoId="aluno-1"
        planoExistente={planoFixture}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar plano/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ planoId: 'plano-1', alunoId: 'aluno-1' }),
      expect.anything(),
    );
  });
});
