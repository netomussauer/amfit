'use client';

import { useState } from 'react';
import { Check, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TreinoResponse } from '@amfit/shared';
import { useAtualizarTreino } from '../hooks/useAtualizarTreino';
import { useRemoverTreino } from '../hooks/useRemoverTreino';
import { useReordenarItens } from '../hooks/useReordenarItens';
import { ItemTreinoRow } from './ItemTreinoRow';
import { Modal } from './Modal';
import { ItemTreinoForm } from './ItemTreinoForm';

type Props = {
  fichaId: string;
  treino: TreinoResponse;
};

export function TreinoCard({ fichaId, treino }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingNome, setEditingNome] = useState(false);
  const [nomeDraft, setNomeDraft] = useState(treino.nome ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const { mutate: atualizarTreino, isPending: isSavingNome } =
    useAtualizarTreino();
  const { mutate: removerTreino, isPending: isRemovingTreino } =
    useRemoverTreino();
  const { mutate: reordenar, isPending: isReordering } = useReordenarItens();

  const itens = treino.itens;
  const proximaOrdem =
    itens.length === 0
      ? 0
      : Math.max(...itens.map((item) => item.ordem)) + 1;

  function handleSaveNome() {
    const novoNome = nomeDraft.trim();
    setActionError(null);
    atualizarTreino(
      {
        fichaId,
        treinoId: treino.id,
        payload: { nome: novoNome === '' ? '' : novoNome },
      },
      {
        onSuccess: () => setEditingNome(false),
        onError: () =>
          setActionError('Não foi possível atualizar o nome do treino.'),
      },
    );
  }

  function handleCancelNome() {
    setNomeDraft(treino.nome ?? '');
    setEditingNome(false);
  }

  function handleRemoveTreino() {
    setMenuOpen(false);
    const confirmacao = window.confirm(
      `Remover o treino ${treino.letra} e todos os seus exercícios?`,
    );
    if (!confirmacao) return;
    setActionError(null);
    removerTreino(
      { fichaId, treinoId: treino.id },
      {
        onError: () => setActionError('Não foi possível remover o treino.'),
      },
    );
  }

  function handleMove(itemIndex: number, direction: -1 | 1) {
    const target = itemIndex + direction;
    if (target < 0 || target >= itens.length) return;
    const ids = itens.map((item) => item.id);
    [ids[itemIndex], ids[target]] = [ids[target], ids[itemIndex]] as [
      string,
      string,
    ];
    setActionError(null);
    reordenar(
      { fichaId, treinoId: treino.id, ids },
      {
        onError: () =>
          setActionError(
            'Não foi possível reordenar os exercícios. A ordem foi restaurada.',
          ),
      },
    );
  }

  return (
    <article
      aria-labelledby={`treino-${treino.id}-heading`}
      className="rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm"
    >
      <header className="flex items-center gap-3 border-b border-[--color-border] px-4 py-3">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[--color-primary] text-base font-bold text-white"
        >
          {treino.letra}
        </span>

        <div className="min-w-0 flex-1">
          <h3
            id={`treino-${treino.id}-heading`}
            className="text-sm font-semibold text-[--color-text]"
          >
            Treino {treino.letra}
          </h3>

          {editingNome ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={nomeDraft}
                onChange={(e) => setNomeDraft(e.target.value)}
                placeholder="Nome opcional do treino"
                aria-label={`Nome do treino ${treino.letra}`}
                className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-2 py-1 text-xs text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
              />
              <IconButton
                label="Salvar nome"
                disabled={isSavingNome}
                onClick={handleSaveNome}
                icon={<Check aria-hidden="true" className="h-4 w-4" />}
              />
              <IconButton
                label="Cancelar"
                disabled={isSavingNome}
                onClick={handleCancelNome}
                icon={<X aria-hidden="true" className="h-4 w-4" />}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNome(true)}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-[--color-text-muted] hover:text-[--color-primary]"
            >
              <span className="truncate">
                {treino.nome ? treino.nome : 'Adicionar nome (opcional)'}
              </span>
              <Pencil aria-hidden="true" className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="relative">
          <IconButton
            label="Mais opções"
            onClick={() => setMenuOpen((v) => !v)}
            icon={<MoreVertical aria-hidden="true" className="h-4 w-4" />}
          />
          {menuOpen && (
            <div
              role="menu"
              aria-label={`Opções do treino ${treino.letra}`}
              className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-[--color-border] bg-[--color-bg] py-1 shadow-md"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setEditingNome(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[--color-text] hover:bg-[--color-bg-muted]"
              >
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                Editar nome
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleRemoveTreino}
                disabled={isRemovingTreino}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[--color-danger] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                Remover treino
              </button>
            </div>
          )}
        </div>
      </header>

      {actionError && (
        <p
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-[--color-danger]"
        >
          {actionError}
        </p>
      )}

      <div className="space-y-3 p-4">
        {itens.length === 0 ? (
          <p className="text-center text-xs text-[--color-text-muted]">
            Nenhum exercício neste treino ainda.
          </p>
        ) : (
          <ul className="space-y-2" aria-label={`Exercícios do treino ${treino.letra}`}>
            {itens.map((item, index) => (
              <ItemTreinoRow
                key={item.id}
                fichaId={fichaId}
                item={item}
                index={index}
                totalItems={itens.length}
                isReordering={isReordering}
                onMoveUp={() => handleMove(index, -1)}
                onMoveDown={() => handleMove(index, 1)}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setAddItemOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[--color-border] px-3 py-2 text-sm font-medium text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Adicionar exercício
        </button>
      </div>

      <Modal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        title={`Adicionar exercício — Treino ${treino.letra}`}
        description="Selecione um exercício e configure os parâmetros de execução."
      >
        <ItemTreinoForm
          mode="create"
          fichaId={fichaId}
          treinoId={treino.id}
          ordem={proximaOrdem}
          onSuccess={() => setAddItemOpen(false)}
          onCancel={() => setAddItemOpen(false)}
        />
      </Modal>
    </article>
  );
}

type IconButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

function IconButton({ label, icon, onClick, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-[--color-text-muted] transition-colors hover:bg-[--color-bg-muted] hover:text-[--color-text] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}
