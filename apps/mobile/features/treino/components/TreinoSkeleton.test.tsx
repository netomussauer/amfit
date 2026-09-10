import { render, screen } from '@testing-library/react-native';
import { TreinoSkeleton } from './TreinoSkeleton';

// react-native-reanimated não tem os módulos nativos disponíveis no ambiente
// de teste — usamos o mock oficial da própria lib (mesmo padrão do
// RestTimer.test.tsx). react-native-worklets (dependência nova do
// Reanimated 4) já tem um stub global em jest.setup.js.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('TreinoSkeleton', () => {
  it('renderiza sem quebrar', async () => {
    // Act / Assert
    await expect(render(<TreinoSkeleton />)).resolves.toBeDefined();
  });

  it('expõe o accessibilityLabel e role de progresso no container', async () => {
    // Act
    await render(<TreinoSkeleton />);

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
