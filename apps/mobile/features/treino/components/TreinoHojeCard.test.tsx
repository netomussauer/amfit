import { render, screen } from '@testing-library/react-native';
import { TreinoHojeCard } from './TreinoHojeCard';
import { makeItemTreino, makeTreino } from '../__fixtures__/treino.fixtures';

describe('TreinoHojeCard', () => {
  it('exibe a letra e o nome do treino', async () => {
    // Arrange
    const treino = makeTreino({ letra: 'A', nome: 'Peito e tríceps' });

    // Act
    await render(<TreinoHojeCard treino={treino} />);

    // Assert
    expect(screen.getByText('Treino A')).toBeTruthy();
    expect(screen.getByText('Peito e tríceps')).toBeTruthy();
  });

  it('não quebra quando o treino não tem nome', async () => {
    // Arrange
    const treino = makeTreino({ nome: null });

    // Act / Assert
    await expect(render(<TreinoHojeCard treino={treino} />)).resolves.toBeDefined();
  });

  it('exibe a contagem de exercícios no singular quando há apenas 1 item', async () => {
    // Arrange
    const treino = makeTreino({ itens: [makeItemTreino()] });

    // Act
    await render(<TreinoHojeCard treino={treino} />);

    // Assert
    expect(screen.getByText('1 exercício')).toBeTruthy();
  });

  it('exibe a contagem de exercícios no plural quando há mais de 1 item', async () => {
    // Arrange
    const treino = makeTreino({
      itens: [
        makeItemTreino({ id: 'i1' }),
        makeItemTreino({ id: 'i2' }),
      ],
    });

    // Act
    await render(<TreinoHojeCard treino={treino} />);

    // Assert
    expect(screen.getByText('2 exercícios')).toBeTruthy();
  });

  it('renderiza um ExercicioItem para cada item do treino', async () => {
    // Arrange
    const treino = makeTreino({
      itens: [
        makeItemTreino({
          id: 'i1',
          exercicio: {
            id: 'e1',
            nome: 'Supino reto',
            descricao: null,
            grupo_muscular: { id: 'g1', nome: 'Peito' },
            midia_url: null,
            tipo_midia: null,
            is_global: false,
          },
        }),
        makeItemTreino({
          id: 'i2',
          exercicio: {
            id: 'e2',
            nome: 'Crucifixo',
            descricao: null,
            grupo_muscular: { id: 'g1', nome: 'Peito' },
            midia_url: null,
            tipo_midia: null,
            is_global: false,
          },
        }),
      ],
    });

    // Act
    await render(<TreinoHojeCard treino={treino} />);

    // Assert
    expect(screen.getByText('Supino reto')).toBeTruthy();
    expect(screen.getByText('Crucifixo')).toBeTruthy();
  });
});
