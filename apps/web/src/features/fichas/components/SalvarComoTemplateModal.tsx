'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SalvarFichaComoTemplateRequestSchema,
  type SalvarFichaComoTemplateRequest,
  type TemplateResponse,
} from '@amfit/shared';
import { useSalvarFichaComoTemplate } from '../hooks/useSalvarFichaComoTemplate';
import { Modal } from './Modal';

type Props = {
  fichaId: string;
  fichaNome: string;
  onClose: () => void;
  onSuccess: (template: TemplateResponse) => void;
};

/**
 * Salva a ficha atual como um template reaplicável a outro aluno (candidato
 * de roadmap do discovery competitivo, SDD §20.8 item 5). Nível/objetivo
 * são obrigatórios porque o template salvo também vira candidato do
 * matching automático de anamnese, não só um atalho de "clonar ficha".
 */
export function SalvarComoTemplateModal({ fichaId, fichaNome, onClose, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useSalvarFichaComoTemplate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalvarFichaComoTemplateRequest>({
    resolver: zodResolver(SalvarFichaComoTemplateRequestSchema),
    defaultValues: {
      nome: `${fichaNome} (modelo)`,
      nivel: 'INTERMEDIARIO',
      objetivo: 'hipertrofia',
    },
  });

  function onSubmit(values: SalvarFichaComoTemplateRequest) {
    setServerError(null);
    mutate(
      { fichaId, body: values },
      {
        onSuccess: (template) => onSuccess(template),
        onError: (err) => {
          if (err.response?.status === 422) {
            setServerError('Esta ficha não tem nenhum item — adicione exercícios antes de salvar como modelo.');
            return;
          }
          setServerError('Não foi possível salvar como modelo. Tente novamente.');
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Salvar como modelo"
      description="Cria um template reaplicável a outros alunos a partir desta ficha."
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="nome" className="mb-1 block text-sm font-medium text-[--color-text]">
            Nome do modelo *
          </label>
          <input
            id="nome"
            type="text"
            aria-invalid={!!errors.nome}
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('nome')}
          />
          {errors.nome && (
            <p role="alert" className="mt-1 text-xs text-[--color-danger]">
              {errors.nome.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nivel" className="mb-1 block text-sm font-medium text-[--color-text]">
              Nível
            </label>
            <select
              id="nivel"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
              {...register('nivel')}
            >
              <option value="INICIANTE">Iniciante</option>
              <option value="INTERMEDIARIO">Intermediário</option>
              <option value="AVANCADO">Avançado</option>
            </select>
          </div>

          <div>
            <label htmlFor="objetivo" className="mb-1 block text-sm font-medium text-[--color-text]">
              Objetivo
            </label>
            <select
              id="objetivo"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
              {...register('objetivo')}
            >
              <option value="hipertrofia">Hipertrofia</option>
              <option value="emagrecimento">Emagrecimento</option>
              <option value="forca">Força</option>
              <option value="condicionamento">Condicionamento</option>
            </select>
          </div>
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
            disabled={isPending}
            aria-busy={isPending}
            className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Salvando...' : 'Salvar modelo'}
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
