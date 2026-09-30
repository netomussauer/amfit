'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TemplateResponse } from '@amfit/shared';
import { useAlunos } from '@/features/alunos';
import { useCriarFichaFromTemplate } from '../hooks/useCriarFichaFromTemplate';
import { Modal } from './Modal';

type Props = {
  template: TemplateResponse;
  onClose: () => void;
};

/**
 * Aplica um template (curado ou salvo pelo próprio personal) a um aluno
 * escolhido na hora — mesma chamada que TemplateSugestaoCard usa pra
 * aplicar o template sugerido pela anamnese, só que aqui quem escolhe o
 * aluno é o personal, não a anamnese.
 */
export function AplicarTemplateModal({ template, onClose }: Props) {
  const router = useRouter();
  const [alunoId, setAlunoId] = useState('');
  const [vigenciaInicio, setVigenciaInicio] = useState(() => today());
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useCriarFichaFromTemplate();

  const { data: alunos, isLoading: carregandoAlunos } = useAlunos({
    page: 1,
    perPage: 100,
    ativo: true,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!alunoId) return;
    setServerError(null);

    mutate(
      { template_id: template.id, aluno_id: alunoId, vigencia_inicio: vigenciaInicio },
      {
        onSuccess: (ficha) => {
          router.push(`/alunos/${alunoId}/fichas/${ficha.id}`);
          router.refresh();
        },
        onError: (err) => {
          if (err.response?.status === 422) {
            setServerError('Este template não tem itens e não pode ser aplicado.');
            return;
          }
          if (err.response?.status === 404) {
            setServerError('Template ou aluno não encontrado.');
            return;
          }
          setServerError('Não foi possível aplicar o template. Tente novamente.');
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Aplicar modelo a um aluno"
      description={template.nome}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="aluno" className="mb-1 block text-sm font-medium text-[--color-text]">
            Aluno *
          </label>
          <select
            id="aluno"
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            required
            disabled={carregandoAlunos}
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          >
            <option value="" disabled>
              {carregandoAlunos ? 'Carregando alunos...' : 'Selecione um aluno'}
            </option>
            {alunos?.data.map((aluno) => (
              <option key={aluno.id} value={aluno.id}>
                {aluno.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="vigencia_inicio"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Vigência (início)
          </label>
          <input
            id="vigencia_inicio"
            type="date"
            value={vigenciaInicio}
            onChange={(e) => setVigenciaInicio(e.target.value)}
            required
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          />
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
          >
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !alunoId}
            aria-busy={isPending}
            className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Aplicando...' : 'Aplicar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Data local (não UTC) — mesma lógica de TemplateSugestaoCard.
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
