import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { PlanoResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { usePlanoAluno } from './usePlanoAluno';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { getPlano: vi.fn() },
}));

const mockedGetPlano = vi.mocked(financeiroService.getPlano);

const planoFixture: PlanoResponse = {
  id: 'plano-1',
  aluno_id: 'aluno-1',
  valor_mensal: 200,
  dia_vencimento: 10,
  vigencia_inicio: '2026-01-01',
  status: 'ATIVO',
  criado_em: '2026-01-01T10:00:00Z',
  atualizado_em: '2026-01-01T10:00:00Z',
};

describe('usePlanoAluno', () => {
  beforeEach(() => {
    mockedGetPlano.mockReset();
  });

  it('busca o plano do aluno quando alunoId esta presente', async () => {
    mockedGetPlano.mockResolvedValueOnce(planoFixture);

    const { result } = renderHook(() => usePlanoAluno('aluno-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetPlano).toHaveBeenCalledWith('aluno-1');
    expect(result.current.data).toEqual(planoFixture);
  });

  it('nao busca quando alunoId esta ausente', () => {
    renderHook(() => usePlanoAluno(undefined), { wrapper: QueryWrapper });
    expect(mockedGetPlano).not.toHaveBeenCalled();
  });

  it('nao retenta em 404 (aluno sem plano configurado)', async () => {
    const error = new AxiosError('Not Found');
    error.response = {
      status: 404,
      data: {},
      statusText: 'Not Found',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedGetPlano.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePlanoAluno('aluno-1'), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedGetPlano).toHaveBeenCalledTimes(1);
  });
});
