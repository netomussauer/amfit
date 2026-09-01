'use client';

import { useEffect, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';

type Props = {
  visible: boolean;
  /** Duração total do descanso em segundos. */
  duracaoSegundos: number;
  onComplete: () => void;
  onSkip: () => void;
};

/**
 * Cronômetro de descanso em modal.
 *
 * Baseado em <dialog> nativo (mesmo padrão de acessibilidade do `Modal` de
 * fichas: showModal() dá focus trap + backdrop nativos). A contagem
 * regressiva usa setInterval de 1s; a barra de progresso anima com uma
 * transição CSS de `width` cuja duração é a própria duração do descanso —
 * evita depender de bibliotecas de animação (que só existem no app mobile).
 */
export function RestTimer({ visible, duracaoSegundos, onComplete, onSkip }: Props) {
  const [restantes, setRestantes] = useState(duracaoSegundos);
  const [barWidth, setBarWidth] = useState(100);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (visible && !dialog.open) {
      dialog.showModal();
    } else if (!visible && dialog.open) {
      dialog.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    setRestantes(duracaoSegundos);
    completedRef.current = false;

    // Reseta a barra a 100% sem transição e, no frame seguinte, dispara a
    // transição até 0% — precisa de dois frames distintos pra o browser
    // animar em vez de aplicar o valor final direto.
    setBarWidth(100);
    const rafId = requestAnimationFrame(() => setBarWidth(0));

    intervalRef.current = setInterval(() => {
      setRestantes((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (!completedRef.current) {
            completedRef.current = true;
            // Pequeno delay antes de chamar onComplete para o usuário ver o "0".
            setTimeout(onComplete, 250);
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, duracaoSegundos, onComplete]);

  function handleSkip() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    completedRef.current = true;
    onSkip();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Escape (evento `cancel` do <dialog>) tem o mesmo efeito do botão
    // físico de voltar no Android no app mobile: pula o descanso.
    function handleCancel(e: Event) {
      e.preventDefault();
      handleSkip();
    }

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutos = Math.floor(restantes / 60);
  const segundos = restantes % 60;
  const tempoFormatado = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rest-timer-title"
      className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-[--color-border] bg-[--color-bg] p-0 shadow-lg backdrop:bg-black/60"
    >
      <div className="flex flex-col items-center px-6 py-8 text-center">
        <p
          id="rest-timer-title"
          className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
        >
          Descanso
        </p>

        <p
          className="mt-2 text-6xl font-bold tabular-nums text-[--color-primary]"
          role="timer"
          aria-live="polite"
          aria-label={`Descanso, ${tempoFormatado}`}
        >
          {tempoFormatado}
        </p>

        <p className="mt-1 text-sm text-[--color-text-muted]">
          Recupere para a próxima série
        </p>

        <div
          className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[--color-bg-muted]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={duracaoSegundos}
          aria-valuenow={restantes}
        >
          <div
            className="h-2 rounded-full bg-[--color-primary]"
            style={{
              width: `${barWidth}%`,
              transitionProperty: 'width',
              transitionDuration: `${duracaoSegundos}s`,
              transitionTimingFunction: 'linear',
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
        >
          <SkipForward aria-hidden="true" className="h-4 w-4" />
          Pular descanso
        </button>
      </div>
    </dialog>
  );
}
