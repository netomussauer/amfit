import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('copia o texto e mostra "Copiado!"', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="K7M2QX9P" label="Copiar código" />);

    await user.click(screen.getByRole('button', { name: 'Copiar código' }));

    expect(await navigator.clipboard.readText()).toBe('K7M2QX9P');
    expect(screen.getByRole('button', { name: 'Copiado!' })).toBeInTheDocument();
  });

  it('volta ao rótulo original depois de 2 segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopyButton text="x" label="Copiar link" />);

    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(screen.getByRole('button', { name: 'Copiado!' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
  });

  it('avisa para copiar manualmente quando o clipboard falha', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('negado'));
    render(<CopyButton text="x" label="Copiar link" />);

    await user.click(screen.getByRole('button', { name: 'Copiar link' }));

    expect(screen.getByRole('button', { name: 'Copie manualmente' })).toBeInTheDocument();
  });
});
