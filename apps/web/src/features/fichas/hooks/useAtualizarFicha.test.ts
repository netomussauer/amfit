import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { FichaResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useAtualizarFicha } from './useAtualizarFicha';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    update: vi.fn(),
  },
}));

const mockedUpdate = vi.mocked(fichaService.update);

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [],
};

describe('useAtualizarFicha', () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
  });

  it('atualiza a ficha, popula o cache do detalhe e invalida as listas', async () => {
    mockedUpdate.mockResolvedValueOnce({ ...fichaFixture, nome: 'Nome atualizado' });
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarFicha(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ id: 'ficha-1', payload: { nome: 'Nome atualizado' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdate).toHaveBeenCalledWith('ficha-1', { nome: 'Nome atualizado' });
    expect(setQueryDataSpy).toHaveBeenCalledWith(fichaKeys.detail('ficha-1'), {
      ...fichaFixture,
      nome: 'Nome atualizado',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'dados inválidos' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedUpdate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarFicha(), { wrapper: QueryWrapper });

    result.current.mutate({ id: 'ficha-1', payload: { nome: '' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(422);
  });
});
