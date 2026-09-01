import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { polyfillDialogElement } from '../test-utils/polyfill-dialog';
import { Modal } from './Modal';

polyfillDialogElement();

describe('Modal', () => {
  it('nao chama showModal quando open e false', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Título">
        <p>Conteúdo</p>
      </Modal>,
    );

    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog).not.toHaveAttribute('open');
  });

  it('abre o <dialog> nativo (showModal) quando open e true', () => {
    render(
      <Modal open onClose={vi.fn()} title="Editar ficha" description="Descrição do modal">
        <p>Conteúdo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByText('Editar ficha')).toBeInTheDocument();
    expect(screen.getByText('Descrição do modal')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('chama onClose ao clicar no botao de fechar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Editar ficha">
        <p>Conteúdo</p>
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: /fechar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose quando o dialog dispara o evento nativo "close" (ex.: Escape)', () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Editar ficha">
        <p>Conteúdo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    dialog.dispatchEvent(new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose quando o dialog dispara o evento nativo "cancel" (Escape antes do close)', () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Editar ficha">
        <p>Conteúdo</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose ao clicar diretamente no backdrop (no proprio elemento <dialog>)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Editar ficha">
        <p>Conteúdo</p>
      </Modal>,
    );

    // Clicar no <dialog> em si (fora do painel interno) simula o clique no
    // backdrop nativo — o handler compara `e.target === dialogRef.current`.
    await user.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nao chama onClose ao clicar dentro do conteudo do modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Editar ficha">
        <p>Conteúdo clicável</p>
      </Modal>,
    );

    await user.click(screen.getByText('Conteúdo clicável'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
