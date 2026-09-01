import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExercicioListResponse } from '@amfit/shared';
import { useExercicios } from '../hooks/useExercicios';
import { ExercicioGrid } from './ExercicioGrid';

vi.mock('../hooks/useExercicios');

// next/link usa contexto do App Router que nao existe fora de uma arvore
// Next real; substitui por um <a> simples.
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// FiltrosExercicio tem cobertura propria (FiltrosExercicio.test.tsx) e usa
// useGruposMusculares internamente — substitui por um controle simplificado
// para isolar o teste de ExercicioGrid da renderizacao real do filtro.
vi.mock('./FiltrosExercicio', () => ({
  FiltrosExercicio: ({
    onGrupoMuscularChange,
  }: {
    onGrupoMuscularChange: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onGrupoMuscularChange('grupo-costas')}>
      Filtrar por Costas
    </button>
  ),
}));

const mockedUseExercicios = vi.mocked(useExercicios);

function mockUseExerciciosReturn(overrides: Partial<ReturnType<typeof useExercicios>>) {
  mockedUseExercicios.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useExercicios>);
}

const listFixture: ExercicioListResponse = {
  data: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      nome: 'Supino reto',
      descricao: null,
      grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
      midia_url: null,
      tipo_midia: null,
      is_global: false,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      nome: 'Remada curvada',
      descricao: null,
      grupo_muscular: { id: '44444444-4444-4444-4444-444444444444', nome: 'Costas' },
      midia_url: null,
      tipo_midia: null,
      is_global: true,
    },
  ],
};

describe('ExercicioGrid', () => {
  beforeEach(() => {
    mockedUseExercicios.mockReset();
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockUseExerciciosReturn({ isLoading: true });

    render(<ExercicioGrid />);

    expect(screen.queryByRole('list', { name: 'Lista de exercícios' })).not.toBeInTheDocument();
    expect(screen.queryByText('Supino reto')).not.toBeInTheDocument();
  });

  it('exibe mensagem de erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseExerciciosReturn({ isError: true, refetch });

    render(<ExercicioGrid />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os exercícios.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio com CTA de cadastro quando nao ha exercicios e nenhum filtro aplicado', () => {
    mockUseExerciciosReturn({ data: { data: [] } });

    render(<ExercicioGrid />);

    expect(screen.getByText('Nenhum exercício cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cadastrar primeiro exercício/i })).toHaveAttribute(
      'href',
      '/exercicios/novo',
    );
  });

  it('exibe estado vazio sem CTA quando ha filtro aplicado mas nenhum resultado', async () => {
    const user = userEvent.setup();
    mockUseExerciciosReturn({ data: { data: [] } });

    render(<ExercicioGrid />);

    await user.click(screen.getByRole('button', { name: /filtrar por costas/i }));

    expect(
      screen.getByText('Nenhum exercício encontrado com os filtros atuais.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /cadastrar primeiro exercício/i }),
    ).not.toBeInTheDocument();
  });

  it('renderiza a lista de exercicios retornada pelo hook', () => {
    mockUseExerciciosReturn({ data: listFixture });

    render(<ExercicioGrid />);

    const lista = screen.getByRole('list', { name: 'Lista de exercícios' });
    expect(lista).toBeInTheDocument();
    expect(screen.getByText('Supino reto')).toBeInTheDocument();
    expect(screen.getByText('Remada curvada')).toBeInTheDocument();
  });
});
