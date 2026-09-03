import { render, screen, fireEvent } from '@testing-library/react-native';
import { ExercicioBlock } from './ExercicioBlock';
import { useSugestaoProgressao } from '@/features/progresso';
import {
  makeItemTreinoResponse,
  makeRegistroSerieResponse,
} from '../__fixtures__/execucao.fixtures';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({ loop: false, muted: false })),
  VideoView: 'VideoView',
}));

// ExercicioBlock chama useSugestaoProgressao (useQuery por baixo) — mockado
// aqui pra não exigir um QueryClientProvider real nestes testes, que focam
// no layout/composição do bloco. O comportamento do hook em si é coberto
// em useSugestaoProgressao.test.tsx; a integração completa (dado real
// vindo da query influenciando o prefill de carga) é coberta abaixo nos
// testes que configuram um retorno específico.
jest.mock('@/features/progresso', () => ({
  useSugestaoProgressao: jest.fn(),
}));

const mockedUseSugestaoProgressao = useSugestaoProgressao as jest.MockedFunction<
  typeof useSugestaoProgressao
>;

function semSugestao() {
  return { data: undefined, isLoading: false } as ReturnType<typeof useSugestaoProgressao>;
}

describe('ExercicioBlock', () => {
  beforeEach(() => {
    mockedUseSugestaoProgressao.mockReset();
    mockedUseSugestaoProgressao.mockReturnValue(semSugestao());
  });

  it('exibe nome, grupo muscular, série×repetições e carga sugerida do exercício', () => {
    // Arrange
    const item = makeItemTreinoResponse({
      series: 3,
      repeticoes: '10',
      carga_sugerida: 40,
    });

    // Act
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Assert
    expect(screen.getByText(item.exercicio.nome)).toBeTruthy();
    expect(screen.getByText(item.exercicio.grupo_muscular.nome)).toBeTruthy();
    expect(screen.getByText('3×10')).toBeTruthy();
    expect(screen.getByText('Sugerida: 40 kg')).toBeTruthy();
  });

  it('não exibe carga sugerida quando o item não possui carga_sugerida', () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: null });

    // Act
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Assert
    expect(screen.queryByText(/Sugerida:/)).toBeNull();
  });

  it('conta corretamente as séries concluídas em relação ao total', () => {
    // Arrange
    const item = makeItemTreinoResponse({ series: 3 });
    const registros = [
      makeRegistroSerieResponse({ numero_serie: 1, concluida: true }),
      makeRegistroSerieResponse({ numero_serie: 2, concluida: false }),
    ];

    // Act
    render(<ExercicioBlock item={item} registros={registros} onRegistrarSerie={jest.fn()} />);

    // Assert
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('renderiza uma SerieRow para cada série do item', () => {
    // Arrange
    const item = makeItemTreinoResponse({ series: 3 });

    // Act
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Assert
    expect(screen.getByLabelText('Carga da série 1')).toBeTruthy();
    expect(screen.getByLabelText('Carga da série 2')).toBeTruthy();
    expect(screen.getByLabelText('Carga da série 3')).toBeTruthy();
  });

  it('repassa o registro de série correto para cada SerieRow via onRegistrarSerie', () => {
    // Arrange
    const item = makeItemTreinoResponse({ series: 1 });
    const onRegistrarSerie = jest.fn();
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={onRegistrarSerie} />);

    // Act
    fireEvent.press(screen.getByLabelText('Marcar série 1 como concluída'));

    // Assert
    expect(onRegistrarSerie).toHaveBeenCalledWith(
      expect.objectContaining({ numero_serie: 1, item_treino_id: item.id }),
    );
  });

  it('expande ao tocar no cabeçalho e exibe a observação do item', () => {
    // Arrange
    const item = makeItemTreinoResponse({ observacao: 'Manter cotovelos alinhados' });
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);
    expect(screen.queryByText('Manter cotovelos alinhados')).toBeNull();

    // Act
    fireEvent.press(
      screen.getByLabelText(new RegExp(`${item.exercicio.nome}.*expandir mídia`)),
    );

    // Assert
    expect(screen.getByText('Manter cotovelos alinhados')).toBeTruthy();
  });

  it('usa a carga sugerida pelo cálculo de progressão no lugar da carga_sugerida estática, quando disponível', () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });
    mockedUseSugestaoProgressao.mockReturnValue({
      data: {
        exercicio_id: item.exercicio.id,
        tem_sugestao: true,
        direcao: 'AUMENTAR',
        carga_sugerida: 22.5,
        ultima_carga_registrada: 20,
        ultima_media_repeticoes: 10,
      },
      isLoading: false,
    } as ReturnType<typeof useSugestaoProgressao>);

    // Act
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Assert — a carga computada (22,5) prevalece sobre a estática (40)
    expect(screen.getByText('Sugerida: 22,5 kg')).toBeTruthy();
    expect(screen.queryByText('Sugerida: 40 kg')).toBeNull();
  });

  it('cai de volta pra carga_sugerida estática quando tem_sugestao=false', () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });
    mockedUseSugestaoProgressao.mockReturnValue({
      data: { exercicio_id: item.exercicio.id, tem_sugestao: false },
      isLoading: false,
    } as ReturnType<typeof useSugestaoProgressao>);

    // Act
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Assert
    expect(screen.getByText('Sugerida: 40 kg')).toBeTruthy();
  });

  it('exibe o vídeo do exercício quando expandido e tipo_midia é VIDEO', () => {
    // Arrange
    const item = makeItemTreinoResponse({
      exercicio: {
        ...makeItemTreinoResponse().exercicio,
        tipo_midia: 'VIDEO',
        midia_url: 'https://example.com/video.mp4',
      },
    });
    render(<ExercicioBlock item={item} registros={[]} onRegistrarSerie={jest.fn()} />);

    // Act
    fireEvent.press(
      screen.getByLabelText(new RegExp(`${item.exercicio.nome}.*expandir mídia`)),
    );

    // Assert
    expect(screen.getByLabelText('Vídeo do exercício')).toBeTruthy();
  });
});
