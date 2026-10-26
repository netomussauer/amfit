import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TreinoSkeleton } from './TreinoSkeleton';

describe('TreinoSkeleton', () => {
  it('e decorativo: escondido de leitores de tela e sem texto', () => {
    const { container } = render(<TreinoSkeleton />);

    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz).toHaveAttribute('aria-hidden', 'true');
    expect(raiz).toHaveTextContent('');
  });

  it('renderiza o cabecalho e tres linhas de exercicio placeholder', () => {
    const { container } = render(<TreinoSkeleton />);

    // 1 bloco de cabecalho + 3 linhas, todos com animate-pulse
    expect(container.querySelectorAll('.animate-pulse.h-\\[60px\\]')).toHaveLength(3);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(3);
  });
});
