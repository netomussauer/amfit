import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExercicioResponse } from '@amfit/shared';
import { ExercicioCard } from './ExercicioCard';

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

function makeExercicio(overrides: Partial<ExercicioResponse> = {}): ExercicioResponse {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    nome: 'Supino reto',
    descricao: 'Deitado no banco, empurre a barra.',
    grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
    midia_url: null,
    tipo_midia: null,
    is_global: false,
    ...overrides,
  };
}

describe('ExercicioCard', () => {
  it('exibe nome, grupo muscular e descricao do exercicio', () => {
    render(<ExercicioCard exercicio={makeExercicio()} />);

    expect(screen.getByText('Supino reto')).toBeInTheDocument();
    expect(screen.getByText('Peito')).toBeInTheDocument();
    expect(screen.getByText('Deitado no banco, empurre a barra.')).toBeInTheDocument();
  });

  it('linka para a pagina de detalhes do exercicio', () => {
    render(<ExercicioCard exercicio={makeExercicio()} />);

    expect(screen.getByRole('link', { name: /ver detalhes de supino reto/i })).toHaveAttribute(
      'href',
      '/exercicios/22222222-2222-2222-2222-222222222222',
    );
  });

  it('exibe a badge "Global" quando is_global e true', () => {
    render(<ExercicioCard exercicio={makeExercicio({ is_global: true })} />);

    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('nao exibe a badge "Global" quando is_global e false', () => {
    render(<ExercicioCard exercicio={makeExercicio({ is_global: false })} />);

    expect(screen.queryByText('Global')).not.toBeInTheDocument();
  });

  it('nao exibe paragrafo de descricao quando ela esta ausente', () => {
    render(<ExercicioCard exercicio={makeExercicio({ descricao: null })} />);

    expect(screen.queryByText('Deitado no banco, empurre a barra.')).not.toBeInTheDocument();
  });
});
