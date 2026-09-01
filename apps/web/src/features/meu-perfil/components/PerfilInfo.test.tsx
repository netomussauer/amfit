import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoResponse } from '@amfit/shared';
import { useMeuPerfil } from '../hooks/useMeuPerfil';
import { PerfilInfo } from './PerfilInfo';

vi.mock('../hooks/useMeuPerfil');

const mockedUseMeuPerfil = vi.mocked(useMeuPerfil);

function mockPerfil(overrides: Partial<ReturnType<typeof useMeuPerfil>>) {
  mockedUseMeuPerfil.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMeuPerfil>);
}

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

describe('PerfilInfo', () => {
  beforeEach(() => {
    mockedUseMeuPerfil.mockReset();
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockPerfil({ isLoading: true });

    render(<PerfilInfo />);

    expect(screen.queryByText('Nome')).not.toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockPerfil({ isError: true, refetch });

    render(<PerfilInfo />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar seu perfil.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe nome, e-mail, telefone e data de nascimento formatada', () => {
    mockPerfil({ data: alunoFixture });

    render(<PerfilInfo />);

    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('maria@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('11999998888')).toBeInTheDocument();
    expect(screen.getByText('20/05/2000')).toBeInTheDocument();
  });

  it('exibe travessao para telefone e data de nascimento ausentes', () => {
    mockPerfil({ data: { ...alunoFixture, telefone: null, data_nascimento: null } });

    render(<PerfilInfo />);

    const travessoes = screen.getAllByText('—');
    expect(travessoes.length).toBeGreaterThanOrEqual(2);
  });
});
