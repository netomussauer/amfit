import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnamneseResponse, RegistrarAnamneseRequest } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { anamneseService } from '../services/anamnese.service';
import { anamneseKeys } from './query-keys';
import { useRegistrarAnamnese } from './useRegistrarAnamnese';

vi.mock('../services/anamnese.service', () => ({
  anamneseService: { getByAluno: vi.fn(), registrar: vi.fn() },
}));

const mockedRegistrar = vi.mocked(anamneseService.registrar);

const alunoId = '11111111-1111-1111-1111-111111111111';

const payload: RegistrarAnamneseRequest = {
  objetivo: 'Ganhar massa magra',
  pratica_outro_esporte: false,
  respostas: {
    frequencia_semanal: '3_4_dias',
    experiencia_meses: '6_meses_2_anos',
    objetivo: 'hipertrofia',
    restricoes: 'nao',
    disponibilidade: '3_dias',
  },
};

const anamneseFixture: AnamneseResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  aluno_id: alunoId,
  objetivo: payload.objetivo,
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
  template_ficha_id: '33333333-3333-3333-3333-333333333333',
  template_ficha_nome: 'Hipertrofia AB Intermediário',
  preenchido_em: '2026-05-11T16:46:15Z',
  atualizado_em: '2026-05-11T16:46:15Z',
};

describe('useRegistrarAnamnese', () => {
  beforeEach(() => {
    mockedRegistrar.mockReset();
  });

  it('registra a anamnese e grava o resultado no cache de detalhe', async () => {
    mockedRegistrar.mockResolvedValueOnce(anamneseFixture);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useRegistrarAnamnese(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ alunoId, payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedRegistrar).toHaveBeenCalledWith(alunoId, payload);
    expect(setQueryDataSpy).toHaveBeenCalledWith(anamneseKeys.detail(alunoId), anamneseFixture);
    expect(result.current.data?.template_ficha_id).toBe(anamneseFixture.template_ficha_id);
  });

  it('expõe o AxiosError quando a mutation falha (ex.: 422 de opção inválida)', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'opcao de resposta invalida' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedRegistrar.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useRegistrarAnamnese(), { wrapper: QueryWrapper });

    result.current.mutate({ alunoId, payload });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.response?.status).toBe(422);
  });
});
