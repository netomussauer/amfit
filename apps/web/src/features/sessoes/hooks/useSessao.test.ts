import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { sessaoService } from '../services/sessao.service';
import { useSessao } from './useSessao';

vi.mock('../services/sessao.service', () => ({
  sessaoService: {
    getById: vi.fn(),
  },
}));

const mockedGetById = vi.mocked(sessaoService.getById);

const sessaoFixture: SessaoResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-01-10',
  status: 'CONCLUIDO',
  iniciado_em: '2026-01-10T10:00:00Z',
  concluido_em: '2026-01-10T11:00:00Z',
  series: [],
};

describe('useSessao', () => {
  beforeEach(() => {
    mockedGetById.mockReset();
  });

  it('nao dispara o fetch quando id esta ausente', () => {
    renderHook(() => useSessao(undefined), { wrapper: QueryWrapper });

    expect(mockedGetById).not.toHaveBeenCalled();
  });

  it('busca a sessao pelo id quando presente', async () => {
    mockedGetById.mockResolvedValueOnce(sessaoFixture);

    const { result } = renderHook(() => useSessao(sessaoFixture.id), { wrapper: QueryWrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetById).toHaveBeenCalledWith(sessaoFixture.id);
    expect(result.current.data).toEqual(sessaoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetById.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useSessao(sessaoFixture.id), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
