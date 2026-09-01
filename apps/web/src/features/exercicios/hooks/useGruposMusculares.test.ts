import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrupoMuscular } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { useGruposMusculares } from './useGruposMusculares';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    listGrupos: vi.fn(),
  },
}));

const mockedListGrupos = vi.mocked(exercicioService.listGrupos);

const gruposFixture: GrupoMuscular[] = [
  { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  { id: '22222222-2222-2222-2222-222222222222', nome: 'Costas' },
];

describe('useGruposMusculares', () => {
  beforeEach(() => {
    mockedListGrupos.mockReset();
  });

  it('retorna os grupos musculares apos o fetch ter sucesso', async () => {
    mockedListGrupos.mockResolvedValueOnce(gruposFixture);

    const { result } = renderHook(() => useGruposMusculares(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedListGrupos).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(gruposFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedListGrupos.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useGruposMusculares(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
