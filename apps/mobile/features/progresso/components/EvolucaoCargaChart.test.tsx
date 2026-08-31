import { render, screen } from '@testing-library/react-native';
import { EvolucaoCargaChart } from './EvolucaoCargaChart';
import { formatDataIso, formatNumero } from '../lib/chart-data';
import { makeEvolucaoCargaPoint } from '../__fixtures__/progresso.fixtures';

// EvolucaoCargaChart não usa nenhuma biblioteca de gráficos/SVG — é montado
// só com <View>/<Text> nativas (ver comentário no componente), então dá para
// fazer um render completo aqui em vez de só testar a transformação de dados.

describe('EvolucaoCargaChart', () => {
  it('renderiza a carga máxima e a data de cada ponto', () => {
    // Arrange
    const pontos = [
      makeEvolucaoCargaPoint({ sessaoId: 's1', data: '2026-08-01', cargaMaxima: 80 }),
      makeEvolucaoCargaPoint({ sessaoId: 's2', data: '2026-08-08', cargaMaxima: 82.5 }),
    ];

    // Act
    render(<EvolucaoCargaChart pontos={pontos} />);

    // Assert
    // O container é accessibilityElementsHidden por design (ver teste
    // abaixo) — includeHiddenElements é necessário para a query enxergar
    // o subtree mesmo assim.
    const opts = { includeHiddenElements: true };
    expect(screen.getByText(formatNumero(80), opts)).toBeTruthy();
    expect(screen.getByText(formatDataIso('2026-08-01'), opts)).toBeTruthy();
    expect(screen.getByText(formatNumero(82.5), opts)).toBeTruthy();
    expect(screen.getByText(formatDataIso('2026-08-08'), opts)).toBeTruthy();
  });

  it('renderiza um traço "—" para sessões sem carga registrada', () => {
    // Arrange
    const pontos = [makeEvolucaoCargaPoint({ sessaoId: 's1', cargaMaxima: null })];

    // Act
    render(<EvolucaoCargaChart pontos={pontos} />);

    // Assert
    expect(screen.getByText('—', { includeHiddenElements: true })).toBeTruthy();
  });

  it('não quebra quando a lista de pontos está vazia', () => {
    // Act / Assert
    expect(() => render(<EvolucaoCargaChart pontos={[]} />)).not.toThrow();
  });

  it('esconde o gráfico visual de leitores de tela (a lista textual em progresso.tsx é a versão acessível)', () => {
    // Arrange
    const pontos = [makeEvolucaoCargaPoint()];

    // Act
    render(<EvolucaoCargaChart pontos={pontos} />);

    // Assert
    const hiddenContainer = screen.UNSAFE_getByProps({
      accessibilityElementsHidden: true,
    });
    expect(hiddenContainer.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
