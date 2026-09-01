import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { useFichas } from './useFichas';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    list: vi.fn(),
  },
}));

const mockedList = vi.mocked(fichaService.list);

const fichasFixture: FichaListResponse = {
  data: [
    {
      id: 'ficha-1',
      nome: 'Hipertrofia — Maio/2026',
      aluno_id: 'aluno-1',
      vigencia_inicio: '2026-05-01',
      ativa: true,
      treinos: [],
    },
  ],
};

describe('useFichas', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('busca as fichas repassando os params ao service quando aluno_id esta presente', async () => {
    mockedList.mockResolvedValueOnce(fichasFixture);

    const params = { aluno_id: 'aluno-1' };
    const { result } = renderHook(() => useFichas(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedList).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(fichasFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedList.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useFichas({ aluno_id: 'aluno-1' }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  // useFichas nao tem gating de `enabled` — sempre busca, com ou sem
  // aluno_id (a lista de fichas aceita filtro opcional). Achado de
  // code-review: a versao original tinha `enabled: params.aluno_id ?
  // !!params.aluno_id : true`, uma expressao que sempre avaliava pra
  // `true` (ramo verdadeiro vira !!truthy===true, ramo falso cai no `:
  // true`) — dead code removido, comportamento observável não mudou.
  it('busca mesmo quando aluno_id e uma string vazia (sem gating de enabled)', async () => {
    mockedList.mockResolvedValueOnce(fichasFixture);

    const { result } = renderHook(() => useFichas({ aluno_id: '' }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedList).toHaveBeenCalledWith({ aluno_id: '' });
  });

  it('busca todas as fichas quando nenhum filtro e informado', async () => {
    mockedList.mockResolvedValueOnce(fichasFixture);

    const { result } = renderHook(() => useFichas({}), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedList).toHaveBeenCalledWith({});
  });
});
