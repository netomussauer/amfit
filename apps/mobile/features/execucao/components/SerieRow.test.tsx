import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { SerieRow } from './SerieRow';
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

describe('SerieRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preenche a carga com a carga sugerida do item quando não há registro', () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });

    // Act
    render(
      <SerieRow item={item} numeroSerie={1} registro={undefined} onConcluir={jest.fn()} />,
    );

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('40');
    expect(screen.getByLabelText('Repetições da série 1').props.value).toBe('');
  });

  it('preenche os campos com os dados do registro quando existente', () => {
    // Arrange
    const item = makeItemTreinoResponse();
    const registro = makeRegistroSerieResponse({
      carga_realizada: 82.5,
      repeticoes_realizadas: 8,
      concluida: true,
    });

    // Act
    render(
      <SerieRow item={item} numeroSerie={1} registro={registro} onConcluir={jest.fn()} />,
    );

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('82,5');
    expect(screen.getByLabelText('Repetições da série 1').props.value).toBe('8');
  });

  it('atualiza os inputs de carga e repetições ao digitar', () => {
    // Arrange
    const item = makeItemTreinoResponse();

    // Act
    render(
      <SerieRow item={item} numeroSerie={1} registro={undefined} onConcluir={jest.fn()} />,
    );
    fireEvent.changeText(screen.getByLabelText('Carga da série 1'), '55,5');
    fireEvent.changeText(screen.getByLabelText('Repetições da série 1'), '12');

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('55,5');
    expect(screen.getByLabelText('Repetições da série 1').props.value).toBe('12');
  });

  it('chama onConcluir com os dados corretos e dispara haptics ao marcar como concluída', () => {
    // Arrange
    const item = makeItemTreinoResponse();
    const onConcluir = jest.fn();
    render(<SerieRow item={item} numeroSerie={2} registro={undefined} onConcluir={onConcluir} />);
    fireEvent.changeText(screen.getByLabelText('Carga da série 2'), '60');
    fireEvent.changeText(screen.getByLabelText('Repetições da série 2'), '10');

    // Act
    fireEvent.press(screen.getByLabelText('Marcar série 2 como concluída'));

    // Assert
    expect(onConcluir).toHaveBeenCalledWith({
      numero_serie: 2,
      item_treino_id: item.id,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 10,
    });
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('não dispara haptics ao desmarcar uma série já concluída', () => {
    // Arrange
    const item = makeItemTreinoResponse();
    const registro = makeRegistroSerieResponse({ concluida: true });
    const onConcluir = jest.fn();
    render(
      <SerieRow item={item} numeroSerie={1} registro={registro} onConcluir={onConcluir} />,
    );

    // Act
    fireEvent.press(screen.getByLabelText('Marcar série 1 como concluída'));

    // Assert
    expect(onConcluir).toHaveBeenCalledWith(
      expect.objectContaining({ concluida: false }),
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('prioriza a carga sugerida por progressão sobre a carga_sugerida estática do item', () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });

    // Act
    render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={jest.fn()}
      />,
    );

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('22,5');
  });

  it('prioriza a carga do registro já salvo sobre a sugestão de progressão', () => {
    // Arrange
    const item = makeItemTreinoResponse();
    const registro = makeRegistroSerieResponse({ carga_realizada: 60 });

    // Act
    render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={registro}
        cargaSugeridaProgressao={22.5}
        onConcluir={jest.fn()}
      />,
    );

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('60');
  });

  it('aplica a sugestão de progressão quando ela chega depois do primeiro render (query assíncrona)', async () => {
    // Arrange — cargaSugeridaProgressao chega undefined no primeiro render
    // (query ainda não resolveu) e só depois é passada com valor.
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });
    const { rerender } = render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={undefined}
        onConcluir={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('40');

    // Act
    rerender(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={jest.fn()}
      />,
    );

    // Assert
    await waitFor(() =>
      expect(screen.getByLabelText('Carga da série 1').props.value).toBe('22,5'),
    );
  });

  it('não sobrescreve a carga que o aluno já editou quando a sugestão chega depois', async () => {
    // Arrange
    const item = makeItemTreinoResponse({ carga_sugerida: 40 });
    const { rerender } = render(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={undefined}
        onConcluir={jest.fn()}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Carga da série 1'), '35');

    // Act — a sugestão chega DEPOIS do aluno já ter digitado um valor
    rerender(
      <SerieRow
        item={item}
        numeroSerie={1}
        registro={undefined}
        cargaSugeridaProgressao={22.5}
        onConcluir={jest.fn()}
      />,
    );

    // Assert — o valor digitado pelo aluno não é sobrescrito
    expect(screen.getByLabelText('Carga da série 1').props.value).toBe('35');
  });

  it('desabilita os campos de edição quando a série já está concluída', () => {
    // Arrange
    const item = makeItemTreinoResponse();
    const registro = makeRegistroSerieResponse({ concluida: true });

    // Act
    render(
      <SerieRow item={item} numeroSerie={1} registro={registro} onConcluir={jest.fn()} />,
    );

    // Assert
    expect(screen.getByLabelText('Carga da série 1').props.editable).toBe(false);
    expect(screen.getByLabelText('Repetições da série 1').props.editable).toBe(false);
    expect(
      screen.getByLabelText('Marcar série 1 como concluída').props.accessibilityState,
    ).toMatchObject({ checked: true });
  });
});
