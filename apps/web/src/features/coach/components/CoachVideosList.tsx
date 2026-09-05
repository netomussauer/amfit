'use client';

import { useState } from 'react';
import type { CoachVideoResponse } from '@amfit/shared';
import { useVideosDoPersonal } from '../hooks/useVideosDoPersonal';
import { VideoReviewModal } from './VideoReviewModal';

const PER_PAGE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'AGUARDANDO_FEEDBACK', label: 'Aguardando feedback' },
  { value: 'FEEDBACK_ENVIADO', label: 'Feedback enviado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

const STATUS_VISUAL: Record<string, string> = {
  AGUARDANDO_FEEDBACK: 'bg-orange-50 text-[--color-warning]',
  FEEDBACK_ENVIADO: 'bg-green-50 text-[--color-success]',
  ARQUIVADO: 'bg-[--color-bg-muted] text-[--color-text-muted]',
};

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_FEEDBACK: 'Aguardando feedback',
  FEEDBACK_ENVIADO: 'Feedback enviado',
  ARQUIVADO: 'Arquivado',
};

function formatDuracao(segundos: number): string {
  return `${segundos}s`;
}

export function CoachVideosList() {
  const [status, setStatus] = useState('AGUARDANDO_FEEDBACK');
  const [page, setPage] = useState(1);
  const [videoAberto, setVideoAberto] = useState<CoachVideoResponse | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useVideosDoPersonal({
    status: status || undefined,
    page,
    perPage: PER_PAGE,
  });

  const videos = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-4">
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

      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-[--color-text-muted]">
          Carregando vídeos...
        </p>
      ) : isError ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-8 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            Não foi possível carregar os vídeos.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-[--color-text-muted]">Nenhum vídeo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <button
              key={video.id}
              type="button"
              onClick={() => setVideoAberto(video)}
              className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 text-left shadow-sm transition-colors hover:bg-[--color-bg-subtle]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-[--color-text]">
                  {video.aluno_nome ?? 'Aluno'}
                </span>
                <span
                  className={[
                    'inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_VISUAL[video.status] ?? '',
                  ].join(' ')}
                >
                  {STATUS_LABEL[video.status] ?? video.status}
                </span>
              </div>
              {video.exercicio_nome && (
                <p className="mt-1 text-xs text-[--color-text-muted]">{video.exercicio_nome}</p>
              )}
              {video.descricao && (
                <p className="mt-2 line-clamp-2 text-xs text-[--color-text-muted]">
                  {video.descricao}
                </p>
              )}
              <p className="mt-2 text-xs text-[--color-text-muted]">
                {formatDuracao(video.duracao_segundos)}
              </p>
            </button>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--color-text-muted]">
          <span aria-live="polite">
            Página {page} de {totalPages} — {total} {total === 1 ? 'vídeo' : 'vídeos'}
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

      {videoAberto && (
        <VideoReviewModal video={videoAberto} onClose={() => setVideoAberto(null)} />
      )}
    </div>
  );
}
