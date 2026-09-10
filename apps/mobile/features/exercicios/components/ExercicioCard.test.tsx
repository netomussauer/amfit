import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExercicioCard } from './ExercicioCard';
import { makeExercicio } from '../__fixtures__/exercicio.fixtures';

describe('ExercicioCard', () => {
  it('exibe o nome e o grupo muscular do exercício', async () => {
    // Arrange
    const exercicio = makeExercicio({ nome: 'Supino reto', grupo_muscular: { id: 'g1', nome: 'Peito' } });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.getByText('Supino reto')).toBeTruthy();
    expect(screen.getByText('Peito')).toBeTruthy();
  });

  it('exibe o badge "Global" quando is_global é true', async () => {
    // Arrange
    const exercicio = makeExercicio({ is_global: true });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.getByText('Global')).toBeTruthy();
  });

  it('não exibe o badge "Global" quando is_global é false', async () => {
    // Arrange
    const exercicio = makeExercicio({ is_global: false });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.queryByText('Global')).toBeNull();
  });

  it('renderiza uma imagem de preview quando midia_url e tipo_midia são de imagem/gif', async () => {
    // Arrange
    const exercicio = makeExercicio({
      midia_url: 'https://cdn.example.com/midia.jpg',
      tipo_midia: 'IMAGEM',
    });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.queryByTestId('exercicio-card-imagem')).toBeTruthy();
  });

  it('não renderiza imagem quando não há midia_url (usa ícone de fallback)', async () => {
    // Arrange
    const exercicio = makeExercicio({ midia_url: null, tipo_midia: null });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.queryByTestId('exercicio-card-imagem')).toBeNull();
  });

  it('não renderiza imagem quando tipo_midia é VIDEO', async () => {
    // Arrange
    const exercicio = makeExercicio({
      midia_url: 'https://cdn.example.com/midia.mp4',
      tipo_midia: 'VIDEO',
    });

    // Act
    await render(<ExercicioCard exercicio={exercicio} />);

    // Assert
    expect(screen.queryByTestId('exercicio-card-imagem')).toBeNull();
  });

  it('chama onPress com o exercício ao ser pressionado', async () => {
    // Arrange
    const exercicio = makeExercicio({ nome: 'Supino reto' });
    const onPress = jest.fn();
    await render(<ExercicioCard exercicio={exercicio} onPress={onPress} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Exercício Supino reto' }));

    // Assert
    expect(onPress).toHaveBeenCalledWith(exercicio);
  });

  it('não quebra ao ser pressionado sem onPress informado', async () => {
    // Arrange
    const exercicio = makeExercicio();
    await render(<ExercicioCard exercicio={exercicio} />);

    // Act / Assert
    await expect(
      fireEvent.press(screen.getByRole('button', { name: `Exercício ${exercicio.nome}` })),
    ).resolves.not.toThrow();
  });
});
