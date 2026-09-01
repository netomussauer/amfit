import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { FichaResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useCriarFicha } from './useCriarFicha';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    create: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(fichaService.create);

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [],
};

describe('useCriarFicha', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it('cria a ficha, invalida as listas relacionadas e popula o cache do detalhe', async () => {
    mockedCreate.mockResolvedValueOnce(fichaFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useCriarFicha(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = {
      aluno_id: 'aluno-1',
      nome: 'Hipertrofia — Maio/2026',
      vigencia_inicio: '2026-05-01',
    };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedCreate).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.byAluno('aluno-1') });
    expect(setQueryDataSpy).toHaveBeenCalledWith(fichaKeys.detail('ficha-1'), fichaFixture);
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Not Found');
    error.response = {
      status: 404,
      data: { detail: 'aluno não encontrado' },
      statusText: 'Not Found',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedCreate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarFicha(), { wrapper: QueryWrapper });

    result.current.mutate({
      aluno_id: 'aluno-inexistente',
      nome: 'Ficha X',
      vigencia_inicio: '2026-05-01',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(404);
  });
});
