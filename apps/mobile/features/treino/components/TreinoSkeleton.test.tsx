import { render, screen } from '@testing-library/react-native';
import { TreinoSkeleton } from './TreinoSkeleton';

describe('TreinoSkeleton', () => {
  it('renderiza sem quebrar', () => {
    // Act / Assert
    expect(() => render(<TreinoSkeleton />)).not.toThrow();
  });

  it('expõe o accessibilityLabel e role de progresso no container', () => {
    // Act
    render(<TreinoSkeleton />);

    // Assert
    const container = screen.getByLabelText('Carregando treino de hoje');
    expect(container).toBeTruthy();
    // getByRole('progressbar') não localiza o elemento nesta versão do RNTL
    // mesmo com accessibilityRole="progressbar" setado (mesma limitação
    // documentada no teste do EvolucaoCargaChart) — verificamos a prop
    // diretamente, seguindo o padrão UNSAFE_getByProps já usado na feature
    // de progresso.
    expect(container.props.accessibilityRole).toBe('progressbar');
  });
});
