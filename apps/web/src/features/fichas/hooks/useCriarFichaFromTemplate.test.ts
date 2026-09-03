import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { FichaResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useCriarFichaFromTemplate } from './useCriarFichaFromTemplate';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    fromTemplate: vi.fn(),
  },
}));

const mockedFromTemplate = vi.mocked(fichaService.fromTemplate);

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia AB Intermediário',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [],
};

describe('useCriarFichaFromTemplate', () => {
  beforeEach(() => {
    mockedFromTemplate.mockReset();
  });

  it('aplica o template, invalida as listas relacionadas e popula o cache do detalhe', async () => {
    mockedFromTemplate.mockResolvedValueOnce(fichaFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useCriarFichaFromTemplate(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = {
      template_id: 'template-1',
      aluno_id: 'aluno-1',
      vigencia_inicio: '2026-05-01',
    };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedFromTemplate).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.byAluno('aluno-1') });
    expect(setQueryDataSpy).toHaveBeenCalledWith(fichaKeys.detail('ficha-1'), fichaFixture);
  });

  it('expõe o AxiosError quando a mutation falha (ex.: 422 de template sem itens)', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'template sem itens não pode ser aplicado' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedFromTemplate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarFichaFromTemplate(), { wrapper: QueryWrapper });

    result.current.mutate({
      template_id: 'template-vazio',
      aluno_id: 'aluno-1',
      vigencia_inicio: '2026-05-01',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(422);
  });
});
