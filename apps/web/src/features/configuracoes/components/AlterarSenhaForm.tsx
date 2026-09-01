'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAlterarSenha } from '../hooks/useAlterarSenha';
import {
  AlterarSenhaFormSchema,
  type AlterarSenhaFormValues,
} from '../schemas/alterar-senha.schema';

export function AlterarSenhaForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const { mutate, isPending } = useAlterarSenha();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AlterarSenhaFormValues>({
    resolver: zodResolver(AlterarSenhaFormSchema),
    defaultValues: {
      senha_atual: '',
      nova_senha: '',
      confirmar_nova_senha: '',
    },
  });

  function onSubmit(values: AlterarSenhaFormValues) {
    setServerError(null);
    setServerSuccess(null);

    // `confirmar_nova_senha` e apenas validacao client-side — nunca e
    // enviado a API.
    const payload = {
      senha_atual: values.senha_atual,
      nova_senha: values.nova_senha,
    };

    mutate(payload, {
      onSuccess: () => {
        setServerSuccess('Senha alterada com sucesso.');
        reset();
      },
      onError: (err) => {
        const status = err.response?.status;
        const data = err.response?.data as { detail?: string } | undefined;

        if (status === 422) {
          setError('senha_atual', {
            message:
              data?.detail === 'senha atual incorreta'
                ? 'Senha atual incorreta.'
                : data?.detail ?? 'Senha atual incorreta.',
          });
          return;
        }

        setServerError('Não foi possível alterar a senha. Tente novamente.');
      },
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field
        id="senha_atual"
        label="Senha atual"
        type="password"
        required
        error={errors.senha_atual?.message}
        autoComplete="current-password"
        registration={register('senha_atual')}
      />
      <Field
        id="nova_senha"
        label="Nova senha"
        type="password"
        required
        error={errors.nova_senha?.message}
        autoComplete="new-password"
        registration={register('nova_senha')}
        hint="Mínimo de 8 caracteres."
      />
      <Field
        id="confirmar_nova_senha"
        label="Confirmar nova senha"
        type="password"
        required
        error={errors.confirmar_nova_senha?.message}
        autoComplete="new-password"
        registration={register('confirmar_nova_senha')}
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
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Alterando...' : 'Alterar senha'}
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
