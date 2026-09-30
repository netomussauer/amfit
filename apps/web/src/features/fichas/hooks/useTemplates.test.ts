import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TemplateListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { useTemplates } from './useTemplates';

vi.mock('../services/ficha.service', () => ({
  fichaService: { listarTemplates: vi.fn() },
}));

const mockedListarTemplates = vi.mocked(fichaService.listarTemplates);

const templateListFixture: TemplateListResponse = {
  data: [
    {
      id: 'template-1',
      nome: 'Full Body Iniciante',
      nivel: 'INICIANTE',
      objetivo: 'hipertrofia',
      criado_por: 'SISTEMA',
      itens: [],
    },
    {
      id: 'template-2',
      nome: 'Full Body (modelo)',
      nivel: 'INTERMEDIARIO',
      objetivo: 'forca',
      criado_por: 'PERSONAL',
      itens: [],
    },
  ],
};

describe('useTemplates', () => {
  it('busca os templates sem filtro', async () => {
    mockedListarTemplates.mockResolvedValueOnce(templateListFixture);

    const { result } = renderHook(() => useTemplates(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListarTemplates).toHaveBeenCalledWith({});
    expect(result.current.data).toEqual(templateListFixture);
  });

  it('repassa o filtro de nivel/objetivo', async () => {
    mockedListarTemplates.mockResolvedValueOnce(templateListFixture);

    const { result } = renderHook(() => useTemplates({ nivel: 'INICIANTE' }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListarTemplates).toHaveBeenCalledWith({ nivel: 'INICIANTE' });
  });
});
