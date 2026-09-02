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

  it('exibe o placeholder quando nenhum grupo está selecionado', () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular()] });

    // Act
    render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Selecione um grupo muscular')).toBeTruthy();
  });

  it('exibe "Carregando grupos..." enquanto os grupos carregam e nada está selecionado', () => {
    // Arrange
    mockGruposState({ isLoading: true, data: undefined });

    // Act
    render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Carregando grupos...')).toBeTruthy();
  });

  it('exibe o nome do grupo selecionado quando value corresponde a um grupo carregado', () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })] });

    // Act
    render(<GrupoMuscularPicker value="g1" onChange={jest.fn()} />);

    // Assert
    expect(screen.getByText('Peito')).toBeTruthy();
  });

  it('abre o modal com a lista de grupos ao pressionar o seletor', () => {
    // Arrange
    mockGruposState({
      data: [
        makeGrupoMuscular({ id: 'g1', nome: 'Peito' }),
        makeGrupoMuscular({ id: 'g2', nome: 'Costas' }),
      ],
    });
    render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(screen.getByText('Grupo muscular')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selecionar Peito' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Selecionar Costas' })).toBeTruthy();
  });

  it('chama onChange com o id do grupo escolhido e fecha o modal', () => {
    // Arrange
    mockGruposState({ data: [makeGrupoMuscular({ id: 'g1', nome: 'Peito' })] });
    const onChange = jest.fn();
    render(<GrupoMuscularPicker value="" onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar Peito' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('g1');
  });

  it('exibe mensagem de erro quando isError é true', () => {
    // Arrange
    mockGruposState({ isError: true, data: undefined });
    render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(
      screen.getByText('Não foi possível carregar os grupos musculares.'),
    ).toBeTruthy();
  });

  it('exibe estado vazio quando não há grupos e não está carregando', () => {
    // Arrange
    mockGruposState({ data: [] });
    render(<GrupoMuscularPicker value="" onChange={jest.fn()} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar grupo muscular' }));

    // Assert
    expect(screen.getByText('Nenhum grupo muscular disponível.')).toBeTruthy();
  });
});
