import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnamneseResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { anamneseService } from '../services/anamnese.service';
import { useAnamnese } from './useAnamnese';

vi.mock('../services/anamnese.service', () => ({
  anamneseService: { getByAluno: vi.fn(), registrar: vi.fn() },
}));

const mockedGetByAluno = vi.mocked(anamneseService.getByAluno);

const alunoId = '11111111-1111-1111-1111-111111111111';

const anamneseFixture: AnamneseResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  aluno_id: alunoId,
  objetivo: 'Ganhar massa magra',
  pratica_outro_esporte: false,
  respostas: {
    frequencia_semanal: { opcao: '3-4 dias/semana', pontos: 20 },
    experiencia_meses: { opcao: '6 meses a 2 anos', pontos: 15 },
    objetivo: { opcao: 'Hipertrofia', pontos: 10 },
    restricoes: { opcao: 'Não', pontos: 0 },
    disponibilidade: { opcao: '3 dias', pontos: 5 },
  },
  score_calculado: 50,
  nivel_sugerido: 'INTERMEDIARIO',
  preenchido_em: '2026-05-11T16:46:15Z',
  atualizado_em: '2026-05-11T16:46:15Z',
};

function makeAxiosError(status: number) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data: {},
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('useAnamnese', () => {
  beforeEach(() => {
    mockedGetByAluno.mockReset();
  });

  it('retorna a anamnese quando o aluno já preencheu', async () => {
    mockedGetByAluno.mockResolvedValueOnce(anamneseFixture);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useAnamnese(alunoId), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(anamneseFixture);
  });

  it('expõe erro 404 (sem anamnese ainda) como AxiosError sem retentar', async () => {
    mockedGetByAluno.mockRejectedValueOnce(makeAxiosError(404));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useAnamnese(alunoId), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.response?.status).toBe(404);
    expect(mockedGetByAluno).toHaveBeenCalledTimes(1);
  });

  it('não executa a query quando alunoId está ausente', () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useAnamnese(undefined), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetByAluno).not.toHaveBeenCalled();
  });
});
