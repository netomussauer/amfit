import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { useFicha } from './useFicha';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    getById: vi.fn(),
  },
}));

const mockedGetById = vi.mocked(fichaService.getById);

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [],
};

describe('useFicha', () => {
  beforeEach(() => {
    mockedGetById.mockReset();
  });

  it('nao dispara o fetch quando id esta ausente (undefined)', () => {
    renderHook(() => useFicha(undefined), { wrapper: QueryWrapper });

    expect(mockedGetById).not.toHaveBeenCalled();
  });

  it('busca a ficha quando id esta presente', async () => {
    mockedGetById.mockResolvedValueOnce(fichaFixture);

    const { result } = renderHook(() => useFicha('ficha-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetById).toHaveBeenCalledWith('ficha-1');
    expect(result.current.data).toEqual(fichaFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetById.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useFicha('ficha-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
