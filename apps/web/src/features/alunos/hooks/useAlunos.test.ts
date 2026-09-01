import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { alunoService } from '../services/aluno.service';
import { useAlunos } from './useAlunos';

vi.mock('../services/aluno.service', () => ({
  alunoService: {
    list: vi.fn(),
  },
}));

const mockedList = vi.mocked(alunoService.list);

const alunosFixture: AlunoListResponse = {
  data: [
    {
      id: 'aluno-1',
      nome: 'João Silva',
      email: 'joao@aluno.app',
      ativo: true,
      criado_em: '2026-05-11T16:46:15Z',
    },
  ],
  pagination: { total: 1, page: 1, per_page: 20 },
};

describe('useAlunos', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('busca a lista de alunos repassando os params ao service', async () => {
    mockedList.mockResolvedValueOnce(alunosFixture);

    const params = { page: 1, perPage: 20, ativo: true };
    const { result } = renderHook(() => useAlunos(params), { wrapper: QueryWrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedList).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(alunosFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedList.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useAlunos({ page: 1, perPage: 20 }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
