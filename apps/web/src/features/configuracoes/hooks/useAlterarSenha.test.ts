import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { personalService } from '../services/personal.service';
import { useAlterarSenha } from './useAlterarSenha';

vi.mock('../services/personal.service', () => ({
  personalService: {
    alterarMinhaSenha: vi.fn(),
  },
}));

const mockedAlterarSenha = vi.mocked(personalService.alterarMinhaSenha);

describe('useAlterarSenha', () => {
  beforeEach(() => {
    mockedAlterarSenha.mockReset();
  });

  it('chama o service com senha_atual e nova_senha e conclui com sucesso', async () => {
    mockedAlterarSenha.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAlterarSenha(), { wrapper: QueryWrapper });

    result.current.mutate({ senha_atual: 'senhaAntiga123', nova_senha: 'senhaNova12345' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAlterarSenha).toHaveBeenCalledWith({
      senha_atual: 'senhaAntiga123',
      nova_senha: 'senhaNova12345',
    });
  });

  it('expoe o AxiosError 422 quando a senha atual esta incorreta', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'senha atual incorreta' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedAlterarSenha.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAlterarSenha(), { wrapper: QueryWrapper });

    result.current.mutate({ senha_atual: 'senhaErrada12', nova_senha: 'senhaNova12345' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.data).toEqual({ detail: 'senha atual incorreta' });
  });
});
