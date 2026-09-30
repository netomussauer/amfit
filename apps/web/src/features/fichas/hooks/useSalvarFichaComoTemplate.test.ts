import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { TemplateResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { templateKeys } from './query-keys';
import { useSalvarFichaComoTemplate } from './useSalvarFichaComoTemplate';

vi.mock('../services/ficha.service', () => ({
  fichaService: { salvarComoTemplate: vi.fn() },
}));

const mockedSalvarComoTemplate = vi.mocked(fichaService.salvarComoTemplate);

const templateFixture: TemplateResponse = {
  id: 'template-1',
  nome: 'Full Body Modelo',
  nivel: 'AVANCADO',
  objetivo: 'forca',
  criado_por: 'PERSONAL',
  itens: [],
};

describe('useSalvarFichaComoTemplate', () => {
  it('salva a ficha como template repassando fichaId e o corpo', async () => {
    mockedSalvarComoTemplate.mockResolvedValueOnce(templateFixture);

    const { result } = renderHook(() => useSalvarFichaComoTemplate(), { wrapper: QueryWrapper });

    const body = { nome: 'Full Body Modelo', nivel: 'AVANCADO' as const, objetivo: 'forca' as const };
    result.current.mutate({ fichaId: 'ficha-1', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedSalvarComoTemplate).toHaveBeenCalledWith('ficha-1', body);
    expect(result.current.data).toEqual(templateFixture);
  });

  it('invalida a lista de templates para que /modelos mostre o novo modelo', async () => {
    mockedSalvarComoTemplate.mockResolvedValueOnce(templateFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSalvarFichaComoTemplate(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const body = { nome: 'Full Body Modelo', nivel: 'AVANCADO' as const, objetivo: 'forca' as const };
    result.current.mutate({ fichaId: 'ficha-1', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: templateKeys.all });
  });

  it('expõe o AxiosError quando a mutation falha (ex.: 422 de ficha sem itens)', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'a ficha não tem nenhum item para salvar como template' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedSalvarComoTemplate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useSalvarFichaComoTemplate(), { wrapper: QueryWrapper });

    result.current.mutate({
      fichaId: 'ficha-vazia',
      body: { nome: 'Vazia', nivel: 'INICIANTE', objetivo: 'hipertrofia' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(422);
  });
});
