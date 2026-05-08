'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
};

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
};

/**
 * Modal acessível baseado em <dialog> nativo.
 * - showModal() habilita focus trap e overlay backdrop nativos
 * - Escape fecha automaticamente (cancel event)
 * - Click no backdrop fecha
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleCancel(e: Event) {
      e.preventDefault();
      onClose();
    }

    function handleClose() {
      onClose();
    }

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      className={[
        'w-[calc(100vw-2rem)] rounded-lg border border-[--color-border] bg-[--color-bg] p-0 shadow-lg backdrop:bg-black/40',
        sizeClass[size],
      ].join(' ')}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-[--color-border] px-5 py-4">
          <div>
            <h2
              id="modal-title"
              className="text-base font-semibold text-[--color-text]"
            >
              {title}
            </h2>
            {description && (
              <p
                id="modal-description"
                className="mt-1 text-xs text-[--color-text-muted]"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-[--color-text-muted] transition-colors hover:bg-[--color-bg-muted] hover:text-[--color-text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
