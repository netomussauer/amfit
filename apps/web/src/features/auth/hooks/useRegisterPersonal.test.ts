import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AuthResponse } from '@amfit/shared';
import { ROLES } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';
import { useRegisterPersonal } from './useRegisterPersonal';

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

describe('useRegisterPersonal', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedSetAccessToken.mockReset();
    mockedSetRefreshToken.mockReset();
  });

  it('envia POST /auth/register-personal convertendo telefone/cref vazios em undefined', async () => {
    mockedPost.mockResolvedValueOnce({ data: authFixture });

    const { result } = renderHook(() => useRegisterPersonal(), { wrapper: QueryWrapper });

    result.current.mutate({
      nome: 'João Personal',
      email: 'joao@amfit.app',
      senha: 'senhaSegura123',
      telefone: '',
      cref: '',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedPost).toHaveBeenCalledWith('/auth/register-personal', {
      nome: 'João Personal',
      email: 'joao@amfit.app',
      senha: 'senhaSegura123',
      telefone: undefined,
      cref: undefined,
    });
  });

  it('preserva telefone/cref quando preenchidos e persiste os tokens no sucesso', async () => {
    mockedPost.mockResolvedValueOnce({ data: authFixture });

    const { result } = renderHook(() => useRegisterPersonal(), { wrapper: QueryWrapper });

    result.current.mutate({
      nome: 'João Personal',
      email: 'joao@amfit.app',
      senha: 'senhaSegura123',
      telefone: '(11) 99999-9999',
      cref: '000000-G/SP',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedPost).toHaveBeenCalledWith('/auth/register-personal', {
      nome: 'João Personal',
      email: 'joao@amfit.app',
      senha: 'senhaSegura123',
      telefone: '(11) 99999-9999',
      cref: '000000-G/SP',
    });
    expect(mockedSetAccessToken).toHaveBeenCalledWith(authFixture.access_token);
    expect(mockedSetRefreshToken).toHaveBeenCalledWith(authFixture.refresh_token);
  });

  it('expoe o AxiosError 409 quando o e-mail ja esta cadastrado', async () => {
    const error = new AxiosError('Conflict');
    error.response = {
      status: 409,
      data: { detail: 'email já cadastrado' },
      statusText: 'Conflict',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedPost.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useRegisterPersonal(), { wrapper: QueryWrapper });

    result.current.mutate({
      nome: 'João Personal',
      email: 'duplicado@amfit.app',
      senha: 'senhaSegura123',
      telefone: '',
      cref: '',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(409);
    expect(mockedSetAccessToken).not.toHaveBeenCalled();
  });
});
