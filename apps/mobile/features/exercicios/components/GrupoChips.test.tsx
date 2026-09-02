import { fireEvent, render, screen } from '@testing-library/react-native';
import { GrupoChips } from './GrupoChips';
import { makeGrupoMuscular } from '../__fixtures__/exercicio.fixtures';

describe('GrupoChips', () => {
  it('sempre renderiza o chip "Todos"', () => {
    // Act
    render(<GrupoChips grupos={[]} selectedId={null} onSelect={jest.fn()} />);

    // Assert
    expect(screen.getByText('Todos')).toBeTruthy();
  });

  it('renderiza um chip para cada grupo muscular', () => {
    // Arrange
    const grupos = [
      makeGrupoMuscular({ id: 'g1', nome: 'Peito' }),
      makeGrupoMuscular({ id: 'g2', nome: 'Costas' }),
    ];

    // Act
    render(<GrupoChips grupos={grupos} selectedId={null} onSelect={jest.fn()} />);

    // Assert
    expect(screen.getByText('Peito')).toBeTruthy();
    expect(screen.getByText('Costas')).toBeTruthy();
  });

  it('marca o chip "Todos" como selecionado quando selectedId é null', () => {
    // Act
    render(<GrupoChips grupos={[]} selectedId={null} onSelect={jest.fn()} />);

    // Assert
    const chip = screen.getByRole('button', { name: 'Filtrar por Todos' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('marca o chip do grupo correspondente como selecionado', () => {
    // Arrange
    const grupos = [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })];

    // Act
    render(<GrupoChips grupos={grupos} selectedId="g1" onSelect={jest.fn()} />);

    // Assert
    const chip = screen.getByRole('button', { name: 'Filtrar por Peito' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    const todosChip = screen.getByRole('button', { name: 'Filtrar por Todos' });
    expect(todosChip.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('chama onSelect(null) ao pressionar "Todos"', () => {
    // Arrange
    const onSelect = jest.fn();
    render(<GrupoChips grupos={[]} selectedId="g1" onSelect={onSelect} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Filtrar por Todos' }));

    // Assert
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('chama onSelect com o id do grupo pressionado', () => {
    // Arrange
    const grupos = [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })];
    const onSelect = jest.fn();
    render(<GrupoChips grupos={grupos} selectedId={null} onSelect={onSelect} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Filtrar por Peito' }));

    // Assert
    expect(onSelect).toHaveBeenCalledWith('g1');
  });

  it('exibe "Carregando..." e oculta os grupos quando isLoading é true', () => {
    // Arrange
    const grupos = [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })];

    // Act
    render(<GrupoChips grupos={grupos} selectedId={null} onSelect={jest.fn()} isLoading />);

    // Assert
    expect(screen.getByText('Carregando...')).toBeTruthy();
    expect(screen.queryByText('Peito')).toBeNull();
  });
});
