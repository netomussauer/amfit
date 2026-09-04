'use client';

import { useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CriarPlanoRequestSchema,
  AtualizarPlanoRequestSchema,
  type CriarPlanoRequest,
  type AtualizarPlanoRequest,
  type PlanoResponse,
} from '@amfit/shared';
import { useConfigurarPlano } from '../hooks/useConfigurarPlano';
import { useAtualizarPlano } from '../hooks/useAtualizarPlano';

type Props = {
  alunoId: string;
  /** Presente = editando um plano existente (PATCH); ausente = criando (POST). */
  planoExistente?: PlanoResponse;
  onSuccess: (plano: PlanoResponse) => void;
  onCancel: () => void;
};

export function PlanoForm({ alunoId, planoExistente, onSuccess, onCancel }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const criar = useConfigurarPlano();
  const atualizar = useAtualizarPlano();
  const isPending = criar.isPending || atualizar.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarPlanoRequest & AtualizarPlanoRequest>({
    resolver: zodResolver(planoExistente ? AtualizarPlanoRequestSchema : CriarPlanoRequestSchema),
    defaultValues: {
      valor_mensal: planoExistente?.valor_mensal,
      dia_vencimento: planoExistente?.dia_vencimento,
      status: planoExistente?.status,
      observacao: planoExistente?.observacao ?? '',
    } as DefaultValues<CriarPlanoRequest & AtualizarPlanoRequest>,
  });

  function onSubmit(values: CriarPlanoRequest & AtualizarPlanoRequest) {
    setServerError(null);

    if (planoExistente) {
      atualizar.mutate(
        { planoId: planoExistente.id, alunoId, payload: values },
        {
          onSuccess: (plano) => onSuccess(plano),
          onError: () => setServerError('Não foi possível salvar o plano. Tente novamente.'),
        },
      );
      return;
    }

    criar.mutate(
      { alunoId, payload: values },
      {
        onSuccess: (plano) => onSuccess(plano),
        onError: (err) => {
          if (err.response?.status === 409) {
            setServerError('Este aluno já tem um plano ativo.');
            return;
          }
          setServerError('Não foi possível salvar o plano. Tente novamente.');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="valor_mensal"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Valor mensal (R$)
          </label>
          <input
            id="valor_mensal"
            type="number"
            step="0.01"
            min="0.01"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('valor_mensal')}
          />
          {errors.valor_mensal && (
            <p role="alert" className="mt-1 text-xs text-[--color-danger]">
              {errors.valor_mensal.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="dia_vencimento"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Dia do vencimento
          </label>
          <input
            id="dia_vencimento"
            type="number"
            min="1"
            max="28"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('dia_vencimento')}
          />
          {errors.dia_vencimento && (
            <p role="alert" className="mt-1 text-xs text-[--color-danger]">
              {errors.dia_vencimento.message}
            </p>
          )}
        </div>
      </div>

      {planoExistente && (
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-[--color-text]">
            Status
          </label>
          <select
            id="status"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('status')}
          >
            <option value="ATIVO">Ativo</option>
            <option value="SUSPENSO">Suspenso</option>
            <option value="ENCERRADO">Encerrado</option>
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor="observacao"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Observação
        </label>
        <textarea
          id="observacao"
          rows={2}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          {...register('observacao')}
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar plano'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
