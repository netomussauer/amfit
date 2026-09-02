import { Image } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExercicioItem } from './ExercicioItem';
import { makeItemTreino } from '../__fixtures__/treino.fixtures';

describe('ExercicioItem', () => {
  it('exibe nome do exercício, grupo muscular e séries×repetições', () => {
    // Arrange
    const item = makeItemTreino({
      exercicio: {
        id: 'e1',
        nome: 'Supino reto',
        descricao: null,
        grupo_muscular: { id: 'g1', nome: 'Peito' },
        midia_url: null,
        tipo_midia: null,
        is_global: false,
      },
      series: 4,
      repeticoes: '8-10',
    });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.getByText('Supino reto')).toBeTruthy();
    expect(screen.getByText('Peito')).toBeTruthy();
    expect(screen.getByText('4×8-10')).toBeTruthy();
  });

  it('exibe a carga sugerida formatada com vírgula quando não é inteira', () => {
    // Arrange
    const item = makeItemTreino({ carga_sugerida: 12.5 });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.getByText('12,5 kg')).toBeTruthy();
  });

  it('exibe a carga sugerida como inteiro quando não tem casas decimais', () => {
    // Arrange
    const item = makeItemTreino({ carga_sugerida: 10 });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.getByText('10 kg')).toBeTruthy();
  });

  it('não exibe carga nem separador quando carga_sugerida é null', () => {
    // Arrange
    const item = makeItemTreino({ carga_sugerida: null });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.queryByText('•')).toBeNull();
  });

  it('renderiza imagem quando midia_url e tipo_midia são de imagem', () => {
    // Arrange
    const item = makeItemTreino({
      exercicio: {
        id: 'e1',
        nome: 'Supino reto',
        descricao: null,
        grupo_muscular: { id: 'g1', nome: 'Peito' },
        midia_url: 'https://cdn.example.com/midia.jpg',
        tipo_midia: 'IMAGEM',
        is_global: false,
      },
    });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.UNSAFE_queryByType(Image)).toBeTruthy();
  });

  it('não renderiza imagem quando não há midia_url', () => {
    // Arrange
    const item = makeItemTreino();

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  it('não exibe o atalho de evolução quando onPressEvolucao não é informado', () => {
    // Arrange
    const item = makeItemTreino({
      exercicio: {
        id: 'e1',
        nome: 'Supino reto',
        descricao: null,
        grupo_muscular: { id: 'g1', nome: 'Peito' },
        midia_url: null,
        tipo_midia: null,
        is_global: false,
      },
    });

    // Act
    render(<ExercicioItem item={item} />);

    // Assert
    expect(
      screen.queryByRole('button', { name: 'Ver evolução de Supino reto' }),
    ).toBeNull();
  });

  it('chama onPressEvolucao ao pressionar o atalho de evolução', () => {
    // Arrange
    const item = makeItemTreino({
      exercicio: {
        id: 'e1',
        nome: 'Supino reto',
        descricao: null,
        grupo_muscular: { id: 'g1', nome: 'Peito' },
        midia_url: null,
        tipo_midia: null,
        is_global: false,
      },
    });
    const onPressEvolucao = jest.fn();
    render(<ExercicioItem item={item} onPressEvolucao={onPressEvolucao} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Ver evolução de Supino reto' }));

    // Assert
    expect(onPressEvolucao).toHaveBeenCalledTimes(1);
  });
});
