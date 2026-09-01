'use client';

import { useMeuPerfil } from '../hooks/useMeuPerfil';

function formatData(value: string | null | undefined): string {
  if (!value) return '—';
  const [ano, mes, dia] = value.split('-');
  if (!ano || !mes || !dia) return value;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Exibição somente leitura do perfil do aluno. O `Header` (shared) já
 * mostra nome + ação de logout — este componente é um complemento leve com
 * os demais dados cadastrais, sem formulário de edição (o backend não
 * expõe PATCH para ALUNO em /alunos/me).
 */
export function PerfilInfo() {
  const { data: aluno, isLoading, isError, refetch } = useMeuPerfil();

  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        className="h-48 w-full animate-pulse rounded-lg border border-[--color-border] bg-[--color-bg-muted]"
      />
    );
  }

  if (isError || !aluno) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar seu perfil.
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
    <div className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
      <dl className="divide-y divide-[--color-border]">
        <FieldRow label="Nome" value={aluno.nome} />
        <FieldRow label="E-mail" value={aluno.email} />
        <FieldRow label="Telefone" value={aluno.telefone ?? null} />
        <FieldRow
          label="Data de nascimento"
          value={formatData(aluno.data_nascimento)}
        />
      </dl>
    </div>
  );
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </dt>
      <dd className="text-sm text-[--color-text]">{value || '—'}</dd>
    </div>
  );
}
