import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoricoExercicioResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { progressoService } from '../services/progresso.service';
import { useHistoricoExercicio } from './useHistoricoExercicio';

vi.mock('../services/progresso.service', () => ({
  progressoService: {
    getHistoricoExercicio: vi.fn(),
  },
}));

const mockedGetHistorico = vi.mocked(progressoService.getHistoricoExercicio);

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

describe('useHistoricoExercicio', () => {
  beforeEach(() => {
    mockedGetHistorico.mockReset();
  });

  it('nao dispara o fetch quando alunoId esta ausente', () => {
    renderHook(() => useHistoricoExercicio({ alunoId: '', exercicioId: 'exercicio-1' }), {
      wrapper: QueryWrapper,
    });

    expect(mockedGetHistorico).not.toHaveBeenCalled();
  });

  it('nao dispara o fetch quando exercicioId esta ausente', () => {
    renderHook(() => useHistoricoExercicio({ alunoId: 'aluno-1', exercicioId: '' }), {
      wrapper: QueryWrapper,
    });

    expect(mockedGetHistorico).not.toHaveBeenCalled();
  });

  it('busca o historico quando alunoId e exercicioId estao presentes, repassando os params', async () => {
    mockedGetHistorico.mockResolvedValueOnce(historicoFixture);

    const params = { alunoId: 'aluno-1', exercicioId: 'exercicio-1', from: '2026-01-01' };
    const { result } = renderHook(() => useHistoricoExercicio(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetHistorico).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(historicoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetHistorico.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(
      () => useHistoricoExercicio({ alunoId: 'aluno-1', exercicioId: 'exercicio-1' }),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
