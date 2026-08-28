'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { TreinoResponse } from '@amfit/shared';
import { useFicha } from '../hooks/useFicha';
import { useCriarTreino } from '../hooks/useCriarTreino';
import { useDesativarFicha } from '../hooks/useDesativarFicha';
import { TreinoCard } from './TreinoCard';
import { Modal } from './Modal';
import { FichaForm } from './FichaForm';

type Props = {
  fichaId: string;
};

export function FichaBuilder({ fichaId }: Props) {
  const router = useRouter();
  const { data: ficha, isLoading, isError, refetch } = useFicha(fichaId);
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { mutate: criarTreino, isPending: isAddingTreino } = useCriarTreino();
  const { mutate: desativar, isPending: isDeactivating } = useDesativarFicha();

  function handleAddTreino() {
    if (!ficha) return;
    setActionError(null);
    const proximaLetra = nextLetra(ficha.treinos);
    const proximaOrdem =
      ficha.treinos.length === 0
        ? 0
        : Math.max(...ficha.treinos.map((t) => t.ordem)) + 1;

    criarTreino(
      {
        fichaId,
        payload: { letra: proximaLetra, ordem: proximaOrdem },
      },
      {
        onError: () =>
          setActionError('Não foi possível adicionar o treino. Tente novamente.'),
      },
    );
  }

  function handleDesativar() {
    if (!ficha) return;
    const confirmacao = window.confirm(
      `Desativar a ficha "${ficha.nome}"? O aluno não verá mais esta ficha como ativa.`,
    );
    if (!confirmacao) return;
    setActionError(null);
    desativar(fichaId, {
      onSuccess: () => {
        router.replace(`/alunos/${ficha.aluno_id}`);
        router.refresh();
      },
      onError: () =>
        setActionError('Não foi possível desativar a ficha. Tente novamente.'),
    });
  }

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">Carregando ficha...</p>
    );
  }

  if (isError || !ficha) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar esta ficha.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const treinosOrdenados = [...ficha.treinos].sort(
    (a, b) => a.ordem - b.ordem,
  );

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/alunos" className="hover:text-[--color-primary]">
              Alunos
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/alunos/${ficha.aluno_id}`}
              className="hover:text-[--color-primary]"
            >
              Aluno
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>Fichas</li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">{ficha.nome}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3 border-b border-[--color-border] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[--color-text]">
              {ficha.nome}
            </h1>
            <StatusBadge ativa={ficha.ativa} />
          </div>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Vigência: {formatDate(ficha.vigencia_inicio)}
            {ficha.vigencia_fim
              ? ` — ${formatDate(ficha.vigencia_fim)}`
              : ' — em aberto'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditMetaOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted]"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Editar metadata
          </button>
          {ficha.ativa && (
            <button
              type="button"
              onClick={handleDesativar}
              disabled={isDeactivating}
              aria-busy={isDeactivating}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-[--color-danger] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {isDeactivating ? 'Desativando...' : 'Desativar ficha'}
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
        >
          {actionError}
        </p>
      )}

      <section aria-label="Treinos da ficha" className="space-y-4">
        {treinosOrdenados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[--color-border] bg-[--color-bg] px-4 py-8 text-center">
            <p className="text-sm text-[--color-text-muted]">
              Esta ficha ainda não tem treinos.
            </p>
          </div>
        ) : (
          treinosOrdenados.map((treino) => (
            <TreinoCard
              key={treino.id}
              fichaId={fichaId}
              alunoId={ficha.aluno_id}
              treino={treino}
            />
          ))
        )}

        <button
          type="button"
          onClick={handleAddTreino}
          disabled={isAddingTreino}
          aria-busy={isAddingTreino}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[--color-border] bg-[--color-bg] px-4 py-3 text-sm font-medium text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {isAddingTreino ? 'Adicionando...' : 'Adicionar treino'}
        </button>
      </section>

      <Modal
        open={editMetaOpen}
        onClose={() => setEditMetaOpen(false)}
        title="Editar ficha"
        description="Atualize nome, vigência ou status da ficha."
      >
        <FichaForm
          mode="edit"
          alunoId={ficha.aluno_id}
          fichaId={ficha.id}
          defaultValues={{
            nome: ficha.nome,
            vigencia_inicio: ficha.vigencia_inicio,
            vigencia_fim: ficha.vigencia_fim ?? '',
            ativa: ficha.ativa,
          }}
          onCancel={() => setEditMetaOpen(false)}
          onSaved={() => setEditMetaOpen(false)}
        />
      </Modal>
    </div>
  );
}

function StatusBadge({ ativa }: { ativa: boolean }) {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        ativa
          ? 'bg-green-50 text-[--color-success]'
          : 'bg-slate-100 text-[--color-text-muted]',
      ].join(' ')}
    >
      {ativa ? 'Ativa' : 'Inativa'}
    </span>
  );
}

function formatDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}/${mm}/${yyyy}`;
}

function nextLetra(treinos: TreinoResponse[]): string {
  const usadas = new Set(treinos.map((t) => t.letra.toUpperCase()));
  for (let code = 'A'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
    const letra = String.fromCharCode(code);
    if (!usadas.has(letra)) return letra;
  }
  // fallback: AA, AB...
  return `A${treinos.length}`;
}
