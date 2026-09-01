import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { sessaoService } from '../services/sessao.service';
import { useSessoesPorAluno } from './useSessoesPorAluno';

vi.mock('../services/sessao.service', () => ({
  sessaoService: {
    listByAluno: vi.fn(),
  },
}));

const mockedListByAluno = vi.mocked(sessaoService.listByAluno);

const listFixture: SessaoListResponse = {
  data: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      treino_id: '22222222-2222-2222-2222-222222222222',
      treino_letra: 'A',
      treino_nome: 'Treino de peito',
      data_execucao: '2026-01-10',
      status: 'CONCLUIDO',
      iniciado_em: '2026-01-10T10:00:00Z',
      concluido_em: '2026-01-10T11:00:00Z',
      total_series: 12,
      series_concluidas: 12,
    },
  ],
  pagination: { total: 1, page: 1, per_page: 20 },
};

describe('useSessoesPorAluno', () => {
  beforeEach(() => {
    mockedListByAluno.mockReset();
  });

  it('nao dispara o fetch quando alunoId esta ausente', () => {
    renderHook(() => useSessoesPorAluno({ alunoId: '', page: 1, perPage: 20 }), {
      wrapper: QueryWrapper,
    });

    expect(mockedListByAluno).not.toHaveBeenCalled();
  });

  it('busca as sessoes do aluno repassando page e perPage', async () => {
    mockedListByAluno.mockResolvedValueOnce(listFixture);

    const params = { alunoId: '33333333-3333-3333-3333-333333333333', page: 1, perPage: 20 };
    const { result } = renderHook(() => useSessoesPorAluno(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedListByAluno).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(listFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedListByAluno.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(
      () =>
        useSessoesPorAluno({ alunoId: '33333333-3333-3333-3333-333333333333', page: 1, perPage: 20 }),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
