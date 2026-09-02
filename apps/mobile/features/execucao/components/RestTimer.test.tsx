import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { RestTimer } from './RestTimer';

// react-native-reanimated não tem os módulos nativos disponíveis no ambiente
// de teste (jest-expo não inclui um mock automático para ele). Não há
// nenhum precedente de teste de componente com Reanimated/timers/haptics
// neste repositório (web ou mobile) — a abordagem abaixo parte do mock
// oficial da própria biblioteca (`react-native-reanimated/mock`, recomendado
// pela documentação do Reanimated para Jest) e fake timers para controlar o
// `setInterval`/`setTimeout` do cronômetro sem depender de tempo real.
//
// O `useSharedValue` do mock oficial retorna um objeto NOVO a cada
// chamada (`(init) => ({ value: init })`, sem `useRef` por baixo), ao
// contrário da implementação real, que mantém identidade estável entre
// renders. Como `RestTimer` inclui o valor de `useSharedValue` (`progress`)
// no array de dependências do `useEffect` que cria o `setInterval`, essa
// identidade instável faz o efeito ser recriado a cada render — reiniciando
// o cronômetro infinitamente e impedindo qualquer teste de decremento real.
// Isso é uma limitação do mock oficial (não um bug do componente: na lib
// real o valor é estável), então sobrescrevemos aqui apenas `useSharedValue`
// para usar `useRef`, mantendo o resto do mock oficial intacto.
jest.mock('react-native-reanimated', () => {
  const officialMock = require('react-native-reanimated/mock');
  const { useRef } = require('react');
  return {
    ...officialMock,
    useSharedValue: (initial: unknown) => useRef({ value: initial }).current,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

describe('RestTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // `clearAllTimers` (em vez de `runOnlyPendingTimers`) descarta os
    // timers pendentes sem executá-los — testes que não avançam o relógio
    // até o fim (ex: "exibe o tempo total formatado") deixam o
    // `setInterval` do componente pendente, e executá-lo aqui disparuma
    // atualização de estado fora de um `act()` (o que polui o output com
    // warnings do React, embora não faça o teste falhar).
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('exibe o tempo total formatado (mm:ss) ao abrir', () => {
    // Act
    render(
      <RestTimer visible duracaoSegundos={65} onComplete={jest.fn()} onSkip={jest.fn()} />,
    );

    // Assert
    expect(screen.getByText('01:05')).toBeTruthy();
  });

  it('decrementa o contador a cada segundo', async () => {
    // Arrange
    render(
      <RestTimer visible duracaoSegundos={5} onComplete={jest.fn()} onSkip={jest.fn()} />,
    );

    // Act — `advanceTimersByTimeAsync` (em vez de `advanceTimersByTime`) é
    // necessário aqui: a versão síncrona não dá chance ao React de flushar,
    // entre um timer e outro, o `setState` disparado pelo callback do
    // `setInterval`, então o(s) re-render(s) só acontecia(m) bem depois
    // (percebido pelo warning de "update not wrapped in act" durante o
    // `afterEach`). A versão assíncrona intercala microtasks entre os
    // timers, dando ao scheduler do React a chance de processar o update.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    // Assert
    expect(screen.getByText('00:04')).toBeTruthy();

    // Act
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    // Assert
    expect(screen.getByText('00:03')).toBeTruthy();
  });

  it('dispara haptics e chama onComplete (com um pequeno delay) quando o tempo se esgota', async () => {
    // Arrange
    const onComplete = jest.fn();
    render(
      <RestTimer visible duracaoSegundos={2} onComplete={onComplete} onSkip={jest.fn()} />,
    );

    // Act — 2 ticks do intervalo (2000ms) + o delay de 250ms antes de chamar onComplete
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2250);
    });

    // Assert
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('não chama onComplete antes do delay de finalização decorrer', async () => {
    // Arrange
    const onComplete = jest.fn();
    render(
      <RestTimer visible duracaoSegundos={1} onComplete={onComplete} onSkip={jest.fn()} />,
    );

    // Act — apenas o tick de 1s que zera o contador, sem o delay de 250ms
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    // Assert
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('pula o descanso imediatamente ao pressionar "Pular descanso", sem chamar onComplete depois', async () => {
    // Arrange
    const onComplete = jest.fn();
    const onSkip = jest.fn();
    render(
      <RestTimer
        visible
        duracaoSegundos={60}
        onComplete={onComplete}
        onSkip={onSkip}
      />,
    );

    // Act
    fireEvent.press(screen.getByLabelText('Pular descanso'));

    // Assert
    expect(onSkip).toHaveBeenCalledTimes(1);

    // Act — avança bastante tempo; como o interval foi limpo, onComplete nunca dispara
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });

    // Assert
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('limpa o intervalo ao desmontar, sem chamar onComplete após o unmount', async () => {
    // Arrange
    const onComplete = jest.fn();
    const { unmount } = render(
      <RestTimer visible duracaoSegundos={2} onComplete={onComplete} onSkip={jest.fn()} />,
    );

    // Act
    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    // Assert
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('expõe o tempo restante via accessibilityLabel em um alerta', () => {
    // Act
    render(
      <RestTimer visible duracaoSegundos={30} onComplete={jest.fn()} onSkip={jest.fn()} />,
    );

    // Assert
    expect(screen.getByLabelText('Descanso 00:30')).toBeTruthy();
  });
});
