import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExercicioResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { useExercicio } from './useExercicio';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    getById: vi.fn(),
  },
}));

const mockedGetById = vi.mocked(exercicioService.getById);

const exercicioFixture: ExercicioResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Supino reto',
  descricao: 'Instruções de execução',
  grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  midia_url: null,
  tipo_midia: null,
  is_global: false,
};

describe('useExercicio', () => {
  beforeEach(() => {
    mockedGetById.mockReset();
  });

  it('nao dispara o fetch quando id esta ausente', () => {
    renderHook(() => useExercicio(undefined), { wrapper: QueryWrapper });

    expect(mockedGetById).not.toHaveBeenCalled();
  });

  it('busca o exercicio pelo id quando presente', async () => {
    mockedGetById.mockResolvedValueOnce(exercicioFixture);

    const { result } = renderHook(() => useExercicio(exercicioFixture.id), {
      wrapper: QueryWrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetById).toHaveBeenCalledWith(exercicioFixture.id);
    expect(result.current.data).toEqual(exercicioFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetById.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useExercicio(exercicioFixture.id), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
