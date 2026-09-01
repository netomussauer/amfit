import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { PersonalResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { personalService } from '../services/personal.service';
import { personalKeys } from './query-keys';
import { useAtualizarConta } from './useAtualizarConta';

vi.mock('../services/personal.service', () => ({
  personalService: {
    atualizarMinhaConta: vi.fn(),
  },
}));

const mockedAtualizar = vi.mocked(personalService.atualizarMinhaConta);

const contaFixture: PersonalResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'João Personal',
  email: 'joao@amfit.app',
  telefone: '(11) 99999-9999',
  cref: '000000-G/SP',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('useAtualizarConta', () => {
  beforeEach(() => {
    mockedAtualizar.mockReset();
  });

  it('atualiza a conta e popula o cache da query "me" com a resposta', async () => {
    mockedAtualizar.mockResolvedValueOnce({ ...contaFixture, nome: 'João Atualizado' });
    const client = createTestQueryClient();
    // `gcTime: 0` (config de teste) descarta dados sem observer ativo quase
    // imediatamente, entao verificamos a escrita no cache via spy em vez de
    // ler `getQueryData` depois que o efeito ja rodou.
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useAtualizarConta(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ nome: 'João Atualizado' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAtualizar).toHaveBeenCalledWith({ nome: 'João Atualizado' });
    expect(setQueryDataSpy).toHaveBeenCalledWith(personalKeys.me(), {
      ...contaFixture,
      nome: 'João Atualizado',
    });
  });

  it('expoe o AxiosError quando a mutation falha (ex.: 409 de e-mail duplicado)', async () => {
    const error = new AxiosError('Conflict');
    error.response = {
      status: 409,
      data: { detail: 'email já cadastrado' },
      statusText: 'Conflict',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedAtualizar.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarConta(), { wrapper: QueryWrapper });

    result.current.mutate({ email: 'duplicado@amfit.app' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(409);
  });
});
