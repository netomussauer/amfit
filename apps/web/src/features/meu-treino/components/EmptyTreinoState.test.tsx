import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyTreinoState } from './EmptyTreinoState';

describe('EmptyTreinoState', () => {
  it('usa titulo e descricao padrao', () => {
    render(<EmptyTreinoState />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Nenhum treino agendado')).toBeInTheDocument();
    expect(
      screen.getByText('Quando seu personal liberar uma ficha, ela aparecerá aqui.'),
    ).toBeInTheDocument();
  });

  it('aceita titulo e descricao customizados', () => {
    render(<EmptyTreinoState title="Sem treino hoje" description="Descanse." />);

    expect(screen.getByText('Sem treino hoje')).toBeInTheDocument();
    expect(screen.getByText('Descanse.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum treino agendado')).not.toBeInTheDocument();
  });
});
