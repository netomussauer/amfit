import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AuthResponse } from '@amfit/shared';
import { ROLES } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { apiClient } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';
import { useLogin } from './useLogin';

// `apiClient.post` (axios) tem uma assinatura fortemente sobrecarregada que
// dificulta tipar um mock diretamente contra `AxiosResponse`. Como o hook so
// usa `{ data }` da resposta, criamos o mock via `vi.hoisted` e o hook so
// enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedPost } = vi.hoisted(() => ({ mockedPost: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { post: mockedPost },
}));

vi.mock('@/shared/lib/auth', () => ({
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
}));

const mockedSetAccessToken = vi.mocked(setAccessToken);
const mockedSetRefreshToken = vi.mocked(setRefreshToken);

const authFixture: AuthResponse = {
  access_token: 'access-token-abc',
  refresh_token: 'refresh-token-xyz',
  token_type: 'Bearer',
  expires_in: 900,
  usuario: {
    id: '11111111-1111-1111-1111-111111111111',
    nome: 'João Personal',
    role: ROLES.PERSONAL,
  },
};

describe('useLogin', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedSetAccessToken.mockReset();
    mockedSetRefreshToken.mockReset();
  });

  it('envia POST /auth/login com o payload e persiste os tokens quando o login tem sucesso', async () => {
    mockedPost.mockResolvedValueOnce({ data: authFixture });

    const { result } = renderHook(() => useLogin(), { wrapper: QueryWrapper });

    const payload = { email: 'joao@amfit.app', senha: 'senhaSegura123', tipo: ROLES.PERSONAL };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedPost).toHaveBeenCalledWith('/auth/login', payload);
    expect(mockedSetAccessToken).toHaveBeenCalledWith(authFixture.access_token);
    expect(mockedSetRefreshToken).toHaveBeenCalledWith(authFixture.refresh_token);
    expect(result.current.data).toEqual(authFixture);
  });

  it('nao persiste tokens quando a resposta da API nao bate com o schema', async () => {
    mockedPost.mockResolvedValueOnce({ data: { access_token: 'so-isso' } });

    const { result } = renderHook(() => useLogin(), { wrapper: QueryWrapper });

    result.current.mutate({ email: 'joao@amfit.app', senha: 'senhaSegura123', tipo: ROLES.PERSONAL });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockedSetAccessToken).not.toHaveBeenCalled();
    expect(mockedSetRefreshToken).not.toHaveBeenCalled();
  });

  it('expoe o AxiosError 401 quando as credenciais sao invalidas', async () => {
    const error = new AxiosError('Unauthorized');
    error.response = {
      status: 401,
      data: { detail: 'credenciais inválidas' },
      statusText: 'Unauthorized',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedPost.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useLogin(), { wrapper: QueryWrapper });

    result.current.mutate({ email: 'joao@amfit.app', senha: 'senhaErrada12', tipo: ROLES.PERSONAL });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(401);
    expect(mockedSetAccessToken).not.toHaveBeenCalled();
  });
});
