import { fireEvent, render, screen } from '@testing-library/react-native';
import { GrupoMuscularPicker } from './GrupoMuscularPicker';
import { useGruposMusculares } from '../hooks/useGruposMusculares';
import { makeGrupoMuscular } from '../__fixtures__/exercicio.fixtures';

jest.mock('../hooks/useGruposMusculares', () => ({
  useGruposMusculares: jest.fn(),
}));

const mockedUseGruposMusculares = useGruposMusculares as jest.MockedFunction<
  typeof useGruposMusculares
>;

function mockGruposState(
  overrides: Partial<ReturnType<typeof useGruposMusculares>> = {},
) {
  mockedUseGruposMusculares.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useGruposMusculares>);
}

describe('GrupoMuscularPicker', () => {
  beforeEach(() => {
    mockedUseGruposMusculares.mockReset();
  });

  it('exibe o placeholder quando nenhum grupo está selecionado', async () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular()] });

    // Act
    await render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Selecione um grupo muscular')).toBeTruthy();
  });

  it('exibe "Carregando grupos..." enquanto os grupos carregam e nada está selecionado', async () => {
    // Arrange
    mockGruposState({ isLoading: true, data: undefined });

    // Act
    await render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Carregando grupos...')).toBeTruthy();
  });

  it('exibe o nome do grupo selecionado quando value corresponde a um grupo carregado', async () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })] });

    // Act
    await render(<GrupoMuscularPicker value="g1" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Peito')).toBeTruthy();
  });

  it('abre o modal com a lista de grupos ao pressionar o seletor', async () => {
    // Arrange
    mockGruposState({
      data: [
        makeGrupoMuscular({ id: 'g1', nome: 'Peito' }),
        makeGrupoMuscular({ id: 'g2', nome: 'Costas' }),
      ],
    });
    await render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(screen.getByText('Grupo muscular')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selecionar Peito' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selecionar Costas' })).toBeTruthy();
  });

  it('chama onChange com o id do grupo escolhido e fecha o modal', async () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })] });
    const onChange = jest.fn();
    await render(<GrupoMuscularPicker value="" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar Peito' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('g1');
  });

  it('exibe mensagem de erro quando isError é true', async () => {
    // Arrange
    mockGruposState({ isError: true, data: undefined });
    await render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(
      screen.getByText('Não foi possível carregar os grupos musculares.'),
    ).toBeTruthy();
  });

  it('exibe estado vazio quando não há grupos e não está carregando', async () => {
    // Arrange
    mockGruposState({ data: [] });
    await render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    await fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(screen.getByText('Nenhum grupo muscular disponível.')).toBeTruthy();
  });
});
