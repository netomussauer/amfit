import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoricoExercicioResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { meuProgressoService } from '../services/meu-progresso.service';
import { useMeuProgresso } from './useMeuProgresso';

vi.mock('../services/meu-progresso.service', () => ({
  meuProgressoService: {
    getMeuProgresso: vi.fn(),
  },
}));

const mockedGetMeuProgresso = vi.mocked(meuProgressoService.getMeuProgresso);

const historicoFixture: HistoricoExercicioResponse = {
  aluno_id: 'aluno-1',
  exercicio_id: 'exercicio-1',
  pontos: [
    {
      sessao_id: 'sessao-1',
      data_execucao: '2026-01-10',
      numero_serie: 1,
      carga_realizada: 50,
      repeticoes_realizadas: 10,
    },
  ],
};

describe('useMeuProgresso', () => {
  beforeEach(() => {
    mockedGetMeuProgresso.mockReset();
  });

  it('nao dispara o fetch quando exercicioId esta ausente', () => {
    renderHook(() => useMeuProgresso({ exercicioId: '' }), { wrapper: QueryWrapper });

    expect(mockedGetMeuProgresso).not.toHaveBeenCalled();
  });

  it('busca o historico quando exercicioId esta presente, repassando os params', async () => {
    mockedGetMeuProgresso.mockResolvedValueOnce(historicoFixture);

    const params = { exercicioId: 'exercicio-1', from: '2026-01-01' };
    const { result } = renderHook(() => useMeuProgresso(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetMeuProgresso).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(historicoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetMeuProgresso.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useMeuProgresso({ exercicioId: 'exercicio-1' }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
