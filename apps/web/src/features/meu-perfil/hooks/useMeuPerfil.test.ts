import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { meuPerfilService } from '../services/meu-perfil.service';
import { useMeuPerfil } from './useMeuPerfil';

vi.mock('../services/meu-perfil.service', () => ({
  meuPerfilService: {
    buscar: vi.fn(),
  },
}));

const mockedBuscar = vi.mocked(meuPerfilService.buscar);

const alunoFixture: AlunoResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'Maria Silva',
  email: 'maria@exemplo.com',
  telefone: '11999998888',
  data_nascimento: '2000-05-20',
  sexo: 'F',
  ativo: true,
  criado_em: '2026-01-01T00:00:00Z',
};

describe('useMeuPerfil', () => {
  beforeEach(() => {
    mockedBuscar.mockReset();
  });

  it('busca o perfil do aluno autenticado', async () => {
    mockedBuscar.mockResolvedValueOnce(alunoFixture);

    const { result } = renderHook(() => useMeuPerfil(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedBuscar).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(alunoFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedBuscar.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useMeuPerfil(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
