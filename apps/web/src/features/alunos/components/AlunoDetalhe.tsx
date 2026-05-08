'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAluno } from '../hooks/useAluno';
import { useDesativarAluno } from '../hooks/useDesativarAluno';
import { AlunoForm } from './AlunoForm';

type Props = {
  alunoId: string;
};

export function AlunoDetalhe({ alunoId }: Props) {
  const router = useRouter();
  const { data: aluno, isLoading, isError, refetch } = useAluno(alunoId);
  const { mutate: desativar, isPending: isDeactivating } = useDesativarAluno();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleDeactivate() {
    if (!aluno) return;
    const confirmacao = window.confirm(
      `Tem certeza que deseja desativar ${aluno.nome}? Ele perderá o acesso ao app.`,
    );
    if (!confirmacao) return;

    setActionError(null);
    desativar(alunoId, {
      onSuccess: () => {
        router.replace('/alunos');
        router.refresh();
      },
      onError: () => {
        setActionError('Não foi possível desativar o aluno. Tente novamente.');
      },
    });
  }

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">Carregando aluno...</p>
    );
  }

  if (isError || !aluno) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar este aluno.
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

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/alunos" className="hover:text-[--color-primary]">
              Alunos
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">{aluno.nome}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3 border-b border-[--color-border] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">{aluno.nome}</h1>
          <p className="text-sm text-[--color-text-muted]">{aluno.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={[
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              aluno.ativo
                ? 'bg-green-50 text-[--color-success]'
                : 'bg-slate-100 text-[--color-text-muted]',
            ].join(' ')}
          >
            {aluno.ativo ? 'Ativo' : 'Inativo'}
          </span>
          {aluno.ativo && (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              aria-busy={isDeactivating}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-[--color-danger] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeactivating ? 'Desativando...' : 'Desativar aluno'}
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

      <section aria-labelledby="info-heading" className="space-y-4">
        <h2
          id="info-heading"
          className="text-lg font-semibold text-[--color-text]"
        >
          Informações
        </h2>
        <AlunoForm
          mode="edit"
          alunoId={aluno.id}
          defaultValues={{
            nome: aluno.nome,
            email: aluno.email,
            telefone: aluno.telefone ?? '',
            data_nascimento: aluno.data_nascimento ?? '',
            sexo: aluno.sexo ?? undefined,
          }}
        />
      </section>
    </div>
  );
}
