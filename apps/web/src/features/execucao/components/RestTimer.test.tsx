import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { polyfillDialogElement } from '@/features/fichas/test-utils/polyfill-dialog';
import { RestTimer } from './RestTimer';

polyfillDialogElement();

function avancar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nao abre o dialog quando visible=false', () => {
    const { container } = render(
      <RestTimer visible={false} duracaoSegundos={60} onComplete={vi.fn()} onSkip={vi.fn()} />,
    );

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('abre o dialog e mostra a duracao formatada em mm:ss', () => {
    render(<RestTimer visible duracaoSegundos={90} onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Descanso, 01:30');
  });

  it('faz a contagem regressiva de 1 em 1 segundo', () => {
    render(<RestTimer visible duracaoSegundos={90} onComplete={vi.fn()} onSkip={vi.fn()} />);

    avancar(3000);

    expect(screen.getByRole('timer')).toHaveTextContent('01:27');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '87');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '90');
  });

  it('ao zerar, mostra 00:00 e chama onComplete apos o pequeno delay, uma unica vez', () => {
    const onComplete = vi.fn();
    render(<RestTimer visible duracaoSegundos={3} onComplete={onComplete} onSkip={vi.fn()} />);

    avancar(3000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(onComplete).not.toHaveBeenCalled();

    avancar(250);
    expect(onComplete).toHaveBeenCalledTimes(1);

    avancar(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('o botao "Pular descanso" chama onSkip e interrompe a contagem', () => {
    const onSkip = vi.fn();
    const onComplete = vi.fn();
    render(<RestTimer visible duracaoSegundos={3} onComplete={onComplete} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: /pular descanso/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);

    avancar(10_000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Escape (evento cancel do dialog) pula o descanso e impede o fechamento nativo', () => {
    const onSkip = vi.fn();
    render(<RestTimer visible duracaoSegundos={60} onComplete={vi.fn()} onSkip={onSkip} />);

    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      screen.getByRole('dialog').dispatchEvent(cancel);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('fecha o dialog quando visible passa a false', () => {
    const props = { duracaoSegundos: 60, onComplete: vi.fn(), onSkip: vi.fn() };
    const { container, rerender } = render(<RestTimer visible {...props} />);
    expect(container.querySelector('dialog')).toHaveAttribute('open');

    rerender(<RestTimer visible={false} {...props} />);

    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('reinicia a contagem quando reaberto com nova duracao', () => {
    const base = { onComplete: vi.fn(), onSkip: vi.fn() };
    const { rerender } = render(<RestTimer visible duracaoSegundos={60} {...base} />);
    avancar(10_000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:50');

    rerender(<RestTimer visible={false} duracaoSegundos={60} {...base} />);
    rerender(<RestTimer visible duracaoSegundos={120} {...base} />);

    expect(screen.getByRole('timer')).toHaveTextContent('02:00');
  });
});
