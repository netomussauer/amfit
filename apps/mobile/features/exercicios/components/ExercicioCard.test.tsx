import { Image } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExercicioCard } from './ExercicioCard';
import { makeExercicio } from '../__fixtures__/exercicio.fixtures';

describe('ExercicioCard', () => {
  it('exibe o nome e o grupo muscular do exercício', () => {
    // Arrange
    const exercicio = makeExercicio({ nome: 'Supino reto', grupo_muscular: { id: 'g1', nome: 'Peito' } });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.getByText('Supino reto')).toBeTruthy();
    expect(screen.getByText('Peito')).toBeTruthy();
  });

  it('exibe o badge "Global" quando is_global é true', () => {
    // Arrange
    const exercicio = makeExercicio({ is_global: true });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.getByText('Global')).toBeTruthy();
  });

  it('não exibe o badge "Global" quando is_global é false', () => {
    // Arrange
    const exercicio = makeExercicio({ is_global: false });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.queryByText('Global')).toBeNull();
  });

  it('renderiza uma imagem de preview quando midia_url e tipo_midia são de imagem/gif', () => {
    // Arrange
    const exercicio = makeExercicio({
      midia_url: 'https://cdn.example.com/midia.jpg',
      tipo_midia: 'IMAGEM',
    });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.UNSAFE_queryByType(Image)).toBeTruthy();
  });

  it('não renderiza imagem quando não há midia_url (usa ícone de fallback)', () => {
    // Arrange
    const exercicio = makeExercicio({ midia_url: null, tipo_midia: null });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('não renderiza imagem quando tipo_midia é VIDEO', () => {
    // Arrange
    const exercicio = makeExercicio({
      midia_url: 'https://cdn.example.com/midia.mp4',
      tipo_midia: 'VIDEO',
    });

    // Act
    render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('chama onPress com o exercício ao ser pressionado', () => {
    // Arrange
    const exercicio = makeExercicio({ nome: 'Supino reto' });
    const onPress = jest.fn();
    render(<ExercicioCard exercicio={exercicio} onPress={onPress} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Exercício Supino reto' }));

    // Assert
    expect(onPress).toHaveBeenCalledWith(exercicio);
  });

  it('não quebra ao ser pressionado sem onPress informado', () => {
    // Arrange
    const exercicio = makeExercicio();
    render(<ExercicioCard exercicio={exercicio} />);

    // Act / Assert
    expect(() =>
      fireEvent.press(screen.getByRole('button', { name: `Exercício ${exercicio.nome}` })),
    ).not.toThrow();
  });
});
