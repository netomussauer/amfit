'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MensalidadeResponse } from '@amfit/shared';
import { useMensalidades } from '../hooks/useMensalidades';
import { useAtualizarStatusMensalidade } from '../hooks/useAtualizarStatusMensalidade';
import { formatBRL, formatCompetencia } from '../lib/format';
import { MarcarPagaModal } from './MarcarPagaModal';

const PER_PAGE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'ATRASADA', label: 'Atrasada' },
  { value: 'PAGA', label: 'Paga' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'ISENTA', label: 'Isenta' },
];

const STATUS_VISUAL: Record<string, string> = {
  PENDENTE: 'bg-[--color-bg-muted] text-[--color-text-muted]',
  ATRASADA: 'bg-red-50 text-[--color-danger]',
  PAGA: 'bg-green-50 text-[--color-success]',
  CANCELADA: 'bg-[--color-bg-muted] text-[--color-text-muted]',
  ISENTA: 'bg-[--color-bg-muted] text-[--color-text-muted]',
};

export function MensalidadesTable() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [marcandoPaga, setMarcandoPaga] = useState<MensalidadeResponse | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useMensalidades({
    status: status || undefined,
    page,
    perPage: PER_PAGE,
  });
  const { mutate: atualizarStatus } = useAtualizarStatusMensalidade();

  const mensalidades = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function handleCancelar(m: MensalidadeResponse) {
    if (!window.confirm('Cancelar esta mensalidade?')) return;
    atualizarStatus({ mensalidadeId: m.id, payload: { status: 'CANCELADA' } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por status"
          className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-[--color-text-muted]">
            Carregando mensalidades...
          </p>
        ) : isError ? (
          <div className="px-4 py-8 text-center">
            <p role="alert" className="text-sm text-[--color-danger]">
              Não foi possível carregar as mensalidades.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
            >
              Tentar novamente
            </button>
          </div>
        ) : mensalidades.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[--color-text-muted]">Nenhuma mensalidade encontrada.</p>
          </div>
        ) : (
          <table className="w-full divide-y divide-[--color-border]" aria-label="Mensalidades">
            <thead className="bg-[--color-bg-subtle]">
              <tr>
                <Th>Competência</Th>
                <Th>Vencimento</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {mensalidades.map((m) => (
                <tr key={m.id} className="hover:bg-[--color-bg-subtle]">
                  <td className="px-4 py-3 text-sm text-[--color-text]">
                    <Link
                      href={`/alunos/${m.aluno_id}`}
                      className="font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
                    >
                      {formatCompetencia(m.competencia_ano, m.competencia_mes)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[--color-text-muted]">
                    {m.data_vencimento}
                  </td>
                  <td className="px-4 py-3 text-sm text-[--color-text]">
                    {formatBRL(m.valor_pago ?? m.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_VISUAL[m.status] ?? '',
                      ].join(' ')}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(m.status === 'PENDENTE' || m.status === 'ATRASADA') && (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setMarcandoPaga(m)}
                          className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
                        >
                          Marcar paga
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelar(m)}
                          className="text-sm font-medium text-[--color-text-muted] hover:text-[--color-danger]"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mensalidades.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--color-text-muted]">
          <span aria-live="polite">
            Página {page} de {totalPages} — {total}{' '}
            {total === 1 ? 'mensalidade' : 'mensalidades'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label="Página anterior"
              className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || isFetching}
              aria-label="Próxima página"
              className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {marcandoPaga && (
        <MarcarPagaModal
          mensalidade={marcandoPaga}
          onClose={() => setMarcandoPaga(null)}
          onSuccess={() => setMarcandoPaga(null)}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
    >
      {children}
    </th>
  );
}
