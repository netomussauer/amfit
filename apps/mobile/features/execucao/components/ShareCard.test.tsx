import { render, screen } from '@testing-library/react-native';
import { ShareCard, type ShareCardData } from './ShareCard';

function makeData(overrides: Partial<ShareCardData> = {}): ShareCardData {
  return {
    treinoLetra: 'A',
    treinoNome: 'Peito e tríceps',
    dataExecucaoFormatada: '04 de setembro de 2026',
    totalSeries: 12,
    totalExercicios: 4,
    cargaTotalFormatada: '1.240 kg',
    duracaoFormatada: '52 min',
    ...overrides,
  };
}

describe('ShareCard', () => {
  it('exibe a letra e o nome do treino', () => {
    render(<ShareCard data={makeData()} />);
    expect(screen.getByText('Treino A · Peito e tríceps')).toBeTruthy();
  });

  it('omite o nome do treino quando ausente', () => {
    render(<ShareCard data={makeData({ treinoNome: undefined })} />);
    expect(screen.getByText('Treino A')).toBeTruthy();
  });

  it('exibe as estatísticas da sessão', () => {
    render(<ShareCard data={makeData()} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('1.240 kg')).toBeTruthy();
    expect(screen.getByText('52 min')).toBeTruthy();
  });

  it('exibe a data de execução formatada', () => {
    render(<ShareCard data={makeData()} />);
    expect(screen.getByText('04 de setembro de 2026')).toBeTruthy();
  });

  it('não exibe nenhum dado sensível (peso corporal, fotos, medidas)', () => {
    render(<ShareCard data={makeData()} />);
    // Guard-rail: o tipo ShareCardData não tem esses campos, mas o teste
    // documenta a garantia mesmo se alguém adicionar um campo solto depois.
    expect(screen.queryByText(/peso|gordura|foto/i)).toBeNull();
  });
});
