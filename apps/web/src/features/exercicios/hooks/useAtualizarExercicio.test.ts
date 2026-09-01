import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ExercicioResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';
import { useAtualizarExercicio } from './useAtualizarExercicio';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    update: vi.fn(),
  },
}));

const mockedUpdate = vi.mocked(exercicioService.update);

const exercicioFixture: ExercicioResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Supino inclinado',
  descricao: null,
  grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  midia_url: null,
  tipo_midia: null,
  is_global: false,
};

describe('useAtualizarExercicio', () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
  });

  it('atualiza o exercicio, popula o cache do detalhe e invalida a listagem', async () => {
    mockedUpdate.mockResolvedValueOnce(exercicioFixture);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarExercicio(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ id: exercicioFixture.id, payload: { nome: 'Supino inclinado' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdate).toHaveBeenCalledWith(exercicioFixture.id, { nome: 'Supino inclinado' });
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      exercicioKeys.detail(exercicioFixture.id),
      exercicioFixture,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: exercicioKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha (ex.: 403 de exercicio global)', async () => {
    const error = new AxiosError('Forbidden');
    error.response = {
      status: 403,
      data: { detail: 'exercícios globais não podem ser editados' },
      statusText: 'Forbidden',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedUpdate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarExercicio(), { wrapper: QueryWrapper });

    result.current.mutate({ id: exercicioFixture.id, payload: { nome: 'Novo nome' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(403);
  });
});
