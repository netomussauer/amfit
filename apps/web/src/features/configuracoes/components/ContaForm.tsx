'use client';

import { useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AtualizarPersonalRequestSchema,
  type AtualizarPersonalRequest,
} from '@amfit/shared';
import { useMinhaConta } from '../hooks/useMinhaConta';
import { useAtualizarConta } from '../hooks/useAtualizarConta';

const CAMPOS_VALIDAVEIS = ['nome', 'email', 'telefone', 'cref'] as const;
type CampoValidavel = (typeof CAMPOS_VALIDAVEIS)[number];

function isCampoValidavel(field: string): field is CampoValidavel {
  return (CAMPOS_VALIDAVEIS as readonly string[]).includes(field);
}

export function ContaForm() {
  const { data: conta, isLoading, isError, refetch } = useMinhaConta();

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">Carregando seus dados...</p>
    );
  }

  if (isError || !conta) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar seus dados.
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
    <EditContaForm
      defaultValues={{
        nome: conta.nome,
        email: conta.email,
        telefone: conta.telefone ?? '',
        cref: conta.cref ?? '',
      }}
    />
  );
}

function EditContaForm({
  defaultValues,
}: {
  defaultValues: Partial<AtualizarPersonalRequest>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const { mutate, isPending } = useAtualizarConta();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<AtualizarPersonalRequest>({
    resolver: zodResolver(AtualizarPersonalRequestSchema),
    defaultValues: {
      nome: defaultValues.nome ?? '',
      email: defaultValues.email ?? '',
      telefone: defaultValues.telefone ?? '',
      cref: defaultValues.cref ?? '',
    } as DefaultValues<AtualizarPersonalRequest>,
  });

  function onSubmit(values: AtualizarPersonalRequest) {
    setServerError(null);
    setServerSuccess(null);

    mutate(values, {
      onSuccess: () => {
        setServerSuccess('Alterações salvas com sucesso.');
      },
      onError: (err) => {
        const status = err.response?.status;
        const data = err.response?.data as
          | { detail?: string; errors?: { field: string; message: string }[] }
          | undefined;

        if (status === 409) {
          setError('email', {
            message: data?.detail ?? 'Este e-mail já está em uso.',
          });
          return;
        }

        if (status === 422) {
          if (data?.errors?.length) {
            for (const { field, message } of data.errors) {
              if (isCampoValidavel(field)) {
                setError(field, { message });
              }
            }
          }
          setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
          return;
        }

        setServerError('Não foi possível salvar as alterações. Tente novamente.');
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field
        id="nome"
        label="Nome completo"
        required
        error={errors.nome?.message}
        autoComplete="name"
        registration={register('nome')}
      />
      <Field
        id="email"
        label="E-mail"
        type="email"
        required
        error={errors.email?.message}
        autoComplete="email"
        registration={register('email')}
        hint="Este e-mail também é usado para fazer login."
      />
      <Field
        id="telefone"
        label="Telefone"
        type="tel"
        error={errors.telefone?.message}
        autoComplete="tel"
        registration={register('telefone')}
      />
      <Field
        id="cref"
        label="CREF"
        error={errors.cref?.message}
        placeholder="000000-G/SP"
        registration={register('cref')}
      />

      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
        >
          {serverError}
        </p>
      )}

      {serverSuccess && (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-[--color-success]"
        >
          {serverSuccess}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !isDirty}
        aria-busy={isPending}
        className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  );
}

// ── building blocks ─────────────────────────────────────────────────

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Field({
  id,
  label,
  type = 'text',
  required,
  error,
  hint,
  placeholder,
  autoComplete,
  registration,
}: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-[--color-text]"
      >
        {label}
        {required && ' *'}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-required={required ? 'true' : undefined}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-[--color-text-muted]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
