import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ExercicioResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';
import { useCriarExercicio } from './useCriarExercicio';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    create: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(exercicioService.create);

const exercicioFixture: ExercicioResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Supino reto',
  descricao: null,
  grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  midia_url: null,
  tipo_midia: null,
  is_global: false,
};

describe('useCriarExercicio', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it('cria o exercicio repassando data e midia ao service e invalida a listagem', async () => {
    mockedCreate.mockResolvedValueOnce(exercicioFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCriarExercicio(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const midia = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    result.current.mutate({
      data: { nome: 'Supino reto', grupo_muscular_id: exercicioFixture.grupo_muscular.id },
      midia,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedCreate).toHaveBeenCalledWith(
      { nome: 'Supino reto', grupo_muscular_id: exercicioFixture.grupo_muscular.id },
      midia,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: exercicioKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha (ex.: 422 de validacao)', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { errors: [{ field: 'nome', message: 'Nome inválido' }] },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedCreate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarExercicio(), { wrapper: QueryWrapper });

    result.current.mutate({
      data: { nome: '', grupo_muscular_id: exercicioFixture.grupo_muscular.id },
      midia: null,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(422);
  });
});
