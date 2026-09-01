import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { personalService } from '../services/personal.service';
import { useMinhaConta } from './useMinhaConta';

vi.mock('../services/personal.service', () => ({
  personalService: {
    getMinhaConta: vi.fn(),
  },
}));

const mockedGetMinhaConta = vi.mocked(personalService.getMinhaConta);

const contaFixture: PersonalResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'João Personal',
  email: 'joao@amfit.app',
  telefone: '(11) 99999-9999',
  cref: '000000-G/SP',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('useMinhaConta', () => {
  beforeEach(() => {
    mockedGetMinhaConta.mockReset();
  });

  it('retorna os dados da conta apos o fetch ter sucesso', async () => {
    mockedGetMinhaConta.mockResolvedValueOnce(contaFixture);

    const { result } = renderHook(() => useMinhaConta(), { wrapper: QueryWrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(contaFixture);
    expect(mockedGetMinhaConta).toHaveBeenCalledTimes(1);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetMinhaConta.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useMinhaConta(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
