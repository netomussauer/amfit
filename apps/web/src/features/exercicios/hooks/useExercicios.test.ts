import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExercicioListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { useExercicios } from './useExercicios';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    list: vi.fn(),
  },
}));

const mockedList = vi.mocked(exercicioService.list);

const listFixture: ExercicioListResponse = {
  data: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      nome: 'Supino reto',
      descricao: null,
      grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
      midia_url: null,
      tipo_midia: null,
      is_global: false,
    },
  ],
};

describe('useExercicios', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('busca a lista repassando os params de filtro', async () => {
    mockedList.mockResolvedValueOnce(listFixture);

    const params = { busca: 'supino', grupo_muscular_id: '11111111-1111-1111-1111-111111111111' };
    const { result } = renderHook(() => useExercicios(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedList).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(listFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedList.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useExercicios({}), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
