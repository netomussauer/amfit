'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MarcarPagaRequestSchema, type MarcarPagaRequest, type MensalidadeResponse } from '@amfit/shared';
import { Modal } from '@/features/fichas';
import { useMarcarPaga } from '../hooks/useMarcarPaga';

type Props = {
  mensalidade: MensalidadeResponse;
  onClose: () => void;
  onSuccess: () => void;
};

export function MarcarPagaModal({ mensalidade, onClose, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useMarcarPaga();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MarcarPagaRequest>({
    resolver: zodResolver(MarcarPagaRequestSchema),
    defaultValues: {
      valor_pago: mensalidade.valor,
      forma_pagamento: 'PIX',
    },
  });

  function onSubmit(values: MarcarPagaRequest) {
    setServerError(null);
    mutate(
      { mensalidadeId: mensalidade.id, payload: values },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          if (err.response?.status === 409) {
            setServerError('Esta mensalidade não pode ser marcada como paga.');
            return;
          }
          setServerError('Não foi possível registrar o pagamento. Tente novamente.');
        },
      },
    );
  }

  return (
    <Modal open onClose={onClose} title="Marcar mensalidade como paga" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="valor_pago"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Valor pago (R$)
          </label>
          <input
            id="valor_pago"
            type="number"
            step="0.01"
            min="0.01"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('valor_pago')}
          />
          {errors.valor_pago && (
            <p role="alert" className="mt-1 text-xs text-[--color-danger]">
              {errors.valor_pago.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="forma_pagamento"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Forma de pagamento
          </label>
          <select
            id="forma_pagamento"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('forma_pagamento')}
          >
            <option value="PIX">Pix</option>
            <option value="BOLETO">Boleto</option>
            <option value="CARTAO">Cartão</option>
            <option value="DINHEIRO">Dinheiro</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="data_pagamento"
            className="mb-1 block text-sm font-medium text-[--color-text]"
          >
            Data do pagamento
          </label>
          <input
            id="data_pagamento"
            type="date"
            className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            {...register('data_pagamento')}
          />
          <p className="mt-1 text-xs text-[--color-text-muted]">Em branco = hoje.</p>
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
            {isPending ? 'Salvando...' : 'Confirmar pagamento'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
