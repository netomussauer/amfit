import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SugestaoProgressaoResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { meuProgressoService } from '../services/meu-progresso.service';
import { useSugestaoProgressao } from './useSugestaoProgressao';

vi.mock('../services/meu-progresso.service', () => ({
  meuProgressoService: {
    getMinhaSugestao: vi.fn(),
  },
}));

const mockedGetMinhaSugestao = vi.mocked(meuProgressoService.getMinhaSugestao);

const sugestaoFixture: SugestaoProgressaoResponse = {
  exercicio_id: 'exercicio-1',
  tem_sugestao: true,
  direcao: 'AUMENTAR',
  carga_sugerida: 22.5,
  ultima_carga_registrada: 20,
  ultima_media_repeticoes: 10,
};

describe('useSugestaoProgressao', () => {
  beforeEach(() => {
    mockedGetMinhaSugestao.mockReset();
  });

  it('nao dispara o fetch quando exercicioId esta ausente', () => {
    renderHook(() => useSugestaoProgressao(undefined), { wrapper: QueryWrapper });

    expect(mockedGetMinhaSugestao).not.toHaveBeenCalled();
  });

  it('busca a sugestao quando exercicioId esta presente', async () => {
    mockedGetMinhaSugestao.mockResolvedValueOnce(sugestaoFixture);

    const { result } = renderHook(() => useSugestaoProgressao('exercicio-1'), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetMinhaSugestao).toHaveBeenCalledWith('exercicio-1');
    expect(result.current.data).toEqual(sugestaoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetMinhaSugestao.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useSugestaoProgressao('exercicio-1'), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
