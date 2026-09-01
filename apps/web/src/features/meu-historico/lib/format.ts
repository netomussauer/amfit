import type { SessaoStatus } from '@amfit/shared';

export function formatDataIso(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formata duração entre dois timestamps ISO em "Xh Ym" / "Ym" / "Xs".
 * Retorna `null` quando `fim` está ausente (sessão em andamento).
 */
export function formatDuracao(
  inicioIso: string,
  fimIso: string | null | undefined,
): string | null {
  if (!fimIso) return null;

  const inicioMs = Date.parse(inicioIso);
  const fimMs = Date.parse(fimIso);
  if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) return null;

  const totalSeg = Math.max(0, Math.round((fimMs - inicioMs) / 1000));
  if (totalSeg < 60) return `${totalSeg}s`;

  const horas = Math.floor(totalSeg / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);

  if (horas === 0) return `${minutos}m`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h${minutos.toString().padStart(2, '0')}m`;
}

export type StatusVisual = {
  label: string;
  className: string;
};

export function statusVisual(status: SessaoStatus): StatusVisual {
  switch (status) {
    case 'EM_ANDAMENTO':
      return {
        label: 'Em andamento',
        className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      };
    case 'CONCLUIDO':
      return {
        label: 'Concluído',
        className: 'bg-green-50 text-[--color-success] border border-green-200',
      };
    case 'ABANDONADO':
      return {
        label: 'Abandonado',
        className: 'bg-slate-100 text-[--color-text-muted] border border-slate-200',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-100 text-[--color-text-muted] border border-slate-200',
      };
  }
}
