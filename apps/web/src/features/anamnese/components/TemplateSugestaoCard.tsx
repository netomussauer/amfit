'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCriarFichaFromTemplate } from '@/features/fichas';

type Props = {
  alunoId: string;
  templateId: string;
  templateNome: string;
};

export function TemplateSugestaoCard({ alunoId, templateId, templateNome }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useCriarFichaFromTemplate();

  function handleAplicar() {
    setError(null);
    mutate(
      {
        template_id: templateId,
        aluno_id: alunoId,
        vigencia_inicio: today(),
      },
      {
        onSuccess: (ficha) => {
          router.push(`/alunos/${alunoId}/fichas/${ficha.id}`);
          router.refresh();
        },
        onError: (err) => {
          if (err.response?.status === 404) {
            setError('Template não encontrado. Você pode montar a ficha do zero.');
            return;
          }
          if (err.response?.status === 422) {
            setError(
              'Este template não pode ser aplicado (sem exercícios). Monte a ficha do zero.',
            );
            return;
          }
          setError('Não foi possível aplicar o template. Tente novamente.');
        },
      },
    );
  }

  function handleMontarDoZero() {
    router.push(`/alunos/${alunoId}/fichas/nova`);
  }

  return (
    <div className="space-y-3 rounded-lg border border-[--color-primary-light] bg-[--color-bg-subtle] p-4">
      <div>
        <p className="text-sm font-semibold text-[--color-text]">Ficha sugerida</p>
        <p className="text-sm text-[--color-text-muted]">{templateNome}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAplicar}
          disabled={isPending}
          aria-busy={isPending}
          className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Aplicando...' : 'Aplicar este template'}
        </button>
        <button
          type="button"
          onClick={handleMontarDoZero}
          disabled={isPending}
          className="rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Montar do zero
        </button>
      </div>
    </div>
  );
}

// Data local (não UTC) — `toISOString()` já teria virado o dia seguinte
// pra quem está a oeste do UTC (ex: Brasil) nas últimas horas do dia.
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
