import { render, screen } from '@testing-library/react-native';
import { EmptyTreinoState } from './EmptyTreinoState';

describe('EmptyTreinoState', () => {
  it('renderiza o título e a descrição padrão quando nenhuma prop é informada', () => {
    // Act
    render(<EmptyTreinoState />);

    // Assert
    expect(screen.getByText('Nenhum treino agendado')).toBeTruthy();
    expect(
      screen.getByText('Quando seu personal liberar uma ficha, ela aparecerá aqui.'),
    ).toBeTruthy();
  });

  it('renderiza título e descrição customizados quando informados', () => {
    // Act
    render(
      <EmptyTreinoState title="Sem ficha ativa" description="Fale com seu personal." />,
    );

    // Assert
    expect(screen.getByText('Sem ficha ativa')).toBeTruthy();
    expect(screen.getByText('Fale com seu personal.')).toBeTruthy();
    expect(screen.queryByText('Nenhum treino agendado')).toBeNull();
  });
});
