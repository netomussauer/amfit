import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { TemplateResponse } from '@amfit/shared';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { useSalvarFichaComoTemplate } from '../hooks/useSalvarFichaComoTemplate';
import { SalvarComoTemplateModal } from './SalvarComoTemplateModal';

polyfillDialogElement();

vi.mock('../hooks/useSalvarFichaComoTemplate');

const mockedUseSalvarFichaComoTemplate = vi.mocked(useSalvarFichaComoTemplate);

const templateFixture: TemplateResponse = {
  id: 'template-1',
  nome: 'Full Body (modelo)',
  nivel: 'INTERMEDIARIO',
  objetivo: 'hipertrofia',
  criado_por: 'PERSONAL',
  itens: [],
};

function mockMutationReturn(mutate: ReturnType<typeof vi.fn>) {
  mockedUseSalvarFichaComoTemplate.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useSalvarFichaComoTemplate>);
}

function makeUnprocessableError() {
  const error = new AxiosError('Unprocessable Entity');
  error.response = {
    status: 422,
    data: {},
    statusText: 'Unprocessable Entity',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('SalvarComoTemplateModal', () => {
  beforeEach(() => {
    mockedUseSalvarFichaComoTemplate.mockReset();
  });

  it('pré-preenche o nome com "<nome da ficha> (modelo)" e defaults de nível/objetivo', () => {
    mockMutationReturn(vi.fn());

    render(
      <SalvarComoTemplateModal
        fichaId="ficha-1"
        fichaNome="Full Body"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/nome do modelo/i)).toHaveValue('Full Body (modelo)');
    expect(screen.getByLabelText(/^nível$/i)).toHaveValue('INTERMEDIARIO');
    expect(screen.getByLabelText(/^objetivo$/i)).toHaveValue('hipertrofia');
  });

  it('envia o payload confirmado e chama onSuccess com o template criado', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const mutate = vi.fn((_vars, opts) => opts?.onSuccess?.(templateFixture));
    mockMutationReturn(mutate);

    render(
      <SalvarComoTemplateModal
        fichaId="ficha-1"
        fichaNome="Full Body"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar modelo/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        fichaId: 'ficha-1',
        body: expect.objectContaining({
          nome: 'Full Body (modelo)',
          nivel: 'INTERMEDIARIO',
          objetivo: 'hipertrofia',
        }),
      }),
      expect.anything(),
    );
    expect(onSuccess).toHaveBeenCalledWith(templateFixture);
  });

  it('mostra mensagem de erro quando a ficha nao tem itens (422)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => opts?.onError?.(makeUnprocessableError()));
    mockMutationReturn(mutate);

    render(
      <SalvarComoTemplateModal
        fichaId="ficha-1"
        fichaNome="Full Body"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /salvar modelo/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('não tem nenhum item');
  });

  it('chama onClose ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    mockMutationReturn(vi.fn());
    const onClose = vi.fn();

    render(
      <SalvarComoTemplateModal
        fichaId="ficha-1"
        fichaNome="Full Body"
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
