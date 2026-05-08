'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { ItemTreinoResponse } from '@amfit/shared';
import { MidiaPreview } from '@/features/exercicios/components/MidiaPreview';
import { useRemoverItem } from '../hooks/useRemoverItem';
import { Modal } from './Modal';
import { ItemTreinoForm } from './ItemTreinoForm';

type Props = {
  fichaId: string;
  item: ItemTreinoResponse;
  index: number;
  totalItems: number;
  isReordering: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function ItemTreinoRow({
  fichaId,
  item,
  index,
  totalItems,
  isReordering,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { mutate: remover, isPending: isRemoving } = useRemoverItem();

  const isFirst = index === 0;
  const isLast = index === totalItems - 1;

  function handleRemove() {
    const confirmacao = window.confirm(
      `Remover "${item.exercicio.nome}" deste treino?`,
    );
    if (!confirmacao) return;
    setActionError(null);
    remover(
      { fichaId, itemId: item.id },
      {
        onError: () => setActionError('Não foi possível remover este exercício.'),
      },
    );
  }

  return (
    <li className="rounded-md border border-[--color-border] bg-[--color-bg]">
      <div className="flex items-center gap-3 p-3">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-[--color-bg-muted]">
          <MidiaPreview
            url={item.exercicio.midia_url}
            tipo={item.exercicio.tipo_midia}
            alt={item.exercicio.nome}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[--color-text]">
            {item.exercicio.nome}
          </p>
          <p className="truncate text-xs text-[--color-text-muted]">
            {item.series} × {item.repeticoes}
            {typeof item.carga_sugerida === 'number' &&
              ` · ${formatCarga(item.carga_sugerida)} kg`}
            {typeof item.descanso_segundos === 'number' &&
              ` · descanso ${item.descanso_segundos}s`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label="Subir"
            disabled={isFirst || isReordering}
            onClick={onMoveUp}
            icon={<ArrowUp aria-hidden="true" className="h-4 w-4" />}
          />
          <IconButton
            label="Descer"
            disabled={isLast || isReordering}
            onClick={onMoveDown}
            icon={<ArrowDown aria-hidden="true" className="h-4 w-4" />}
          />
          <IconButton
            label="Editar"
            onClick={() => setEditOpen(true)}
            icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
          />
          <IconButton
            label="Remover"
            disabled={isRemoving}
            onClick={handleRemove}
            variant="danger"
            icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          />
        </div>
      </div>

      {item.observacao && (
        <p className="border-t border-[--color-border] px-3 py-2 text-xs italic text-[--color-text-muted]">
          {item.observacao}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-[--color-danger]"
        >
          {actionError}
        </p>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar exercício"
        description="Ajuste séries, repetições e parâmetros adicionais."
      >
        <ItemTreinoForm
          mode="edit"
          fichaId={fichaId}
          item={item}
          onSuccess={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </li>
  );
}

function formatCarga(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

type IconButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
};

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  variant = 'default',
}: IconButtonProps) {
  const variantClass =
    variant === 'danger'
      ? 'text-[--color-danger] hover:bg-red-50'
      : 'text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        'rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-40',
        variantClass,
      ].join(' ')}
    >
      {icon}
    </button>
  );
}
