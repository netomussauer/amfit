import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { alunoService } from '../services/aluno.service';
import { useAluno } from './useAluno';

vi.mock('../services/aluno.service', () => ({
  alunoService: {
    getById: vi.fn(),
  },
}));

const mockedGetById = vi.mocked(alunoService.getById);

const alunoFixture: AlunoResponse = {
  id: 'aluno-1',
  nome: 'João Silva',
  email: 'joao@aluno.app',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('useAluno', () => {
  beforeEach(() => {
    mockedGetById.mockReset();
  });

  it('nao dispara o fetch quando id esta ausente (undefined)', () => {
    renderHook(() => useAluno(undefined), { wrapper: QueryWrapper });

    expect(mockedGetById).not.toHaveBeenCalled();
  });

  it('busca o aluno quando id esta presente', async () => {
    mockedGetById.mockResolvedValueOnce(alunoFixture);

    const { result } = renderHook(() => useAluno('aluno-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetById).toHaveBeenCalledWith('aluno-1');
    expect(result.current.data).toEqual(alunoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetById.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useAluno('aluno-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
