import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { MensalidadeResponse } from '@amfit/shared';
import { polyfillDialogElement } from '@/features/fichas/test-utils/polyfill-dialog';
import { useMarcarPaga } from '../hooks/useMarcarPaga';
import { MarcarPagaModal } from './MarcarPagaModal';

polyfillDialogElement();

vi.mock('../hooks/useMarcarPaga');

const mockedUseMarcarPaga = vi.mocked(useMarcarPaga);

const mensalidadeFixture: MensalidadeResponse = {
  id: 'mensalidade-1',
  plano_id: 'plano-1',
  aluno_id: 'aluno-1',
  competencia_ano: 2026,
  competencia_mes: 9,
  data_vencimento: '2026-09-10',
  valor: 200,
  status: 'PENDENTE',
  criado_em: '2026-09-01T10:00:00Z',
  atualizado_em: '2026-09-01T10:00:00Z',
};

function mockMutationReturn(mutate: ReturnType<typeof vi.fn>) {
  mockedUseMarcarPaga.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useMarcarPaga>);
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

describe('MarcarPagaModal', () => {
  beforeEach(() => {
    mockedUseMarcarPaga.mockReset();
  });

  it('pré-preenche o valor com o valor cheio da mensalidade e Pix como forma padrão', () => {
    mockMutationReturn(vi.fn());

    render(
      <MarcarPagaModal mensalidade={mensalidadeFixture} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    expect(screen.getByLabelText(/valor pago/i)).toHaveValue(200);
    expect(screen.getByLabelText(/forma de pagamento/i)).toHaveValue('PIX');
  });

  it('envia o payload confirmado e chama onSuccess', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const mutate = vi.fn((_vars, opts) => opts?.onSuccess?.());
    mockMutationReturn(mutate);

    render(
      <MarcarPagaModal
        mensalidade={mensalidadeFixture}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mensalidadeId: 'mensalidade-1',
        payload: expect.objectContaining({ valor_pago: 200, forma_pagamento: 'PIX' }),
      }),
      expect.anything(),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('mostra mensagem de erro quando a mensalidade nao pode ser marcada como paga (409)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onError?.(makeConflictError()));
    mockMutationReturn(mutate);

    render(
      <MarcarPagaModal mensalidade={mensalidadeFixture} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('não pode ser marcada como paga');
  });

  it('chama onClose ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    mockMutationReturn(vi.fn());
    const onClose = vi.fn();

    render(
      <MarcarPagaModal mensalidade={mensalidadeFixture} onClose={onClose} onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
