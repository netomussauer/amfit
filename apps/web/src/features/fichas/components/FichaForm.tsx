'use client';

import { useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  AtualizarFichaRequestSchema,
  CriarFichaRequestSchema,
  type AtualizarFichaRequest,
  type CriarFichaRequest,
} from '@amfit/shared';
import { useCriarFicha } from '../hooks/useCriarFicha';
import { useAtualizarFicha } from '../hooks/useAtualizarFicha';

type CreateProps = {
  mode: 'create';
  alunoId: string;
  defaultValues?: Partial<CriarFichaRequest>;
  onCancel?: () => void;
};

type EditProps = {
  mode: 'edit';
  alunoId: string;
  fichaId: string;
  defaultValues: Partial<AtualizarFichaRequest>;
  onCancel?: () => void;
  onSaved?: () => void;
};

type Props = CreateProps | EditProps;

export function FichaForm(props: Props) {
  if (props.mode === 'create') {
    return (
      <CreateFichaForm
        alunoId={props.alunoId}
        defaultValues={props.defaultValues}
        onCancel={props.onCancel}
      />
    );
  }
  return (
    <EditFichaForm
      alunoId={props.alunoId}
      fichaId={props.fichaId}
      defaultValues={props.defaultValues}
      onCancel={props.onCancel}
      onSaved={props.onSaved}
    />
  );
}

// ── Create ────────────────────────────────────────────────────────────

function CreateFichaForm({
  alunoId,
  defaultValues,
  onCancel,
}: {
  alunoId: string;
  defaultValues?: Partial<CriarFichaRequest>;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useCriarFicha();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarFichaRequest>({
    resolver: zodResolver(CriarFichaRequestSchema),
    defaultValues: {
      aluno_id: alunoId,
      nome: '',
      vigencia_inicio: today(),
      vigencia_fim: '',
      ...defaultValues,
    } as DefaultValues<CriarFichaRequest>,
  });

  function onSubmit(values: CriarFichaRequest) {
    setServerError(null);
    mutate(values, {
      onSuccess: (data) => {
        router.replace(`/alunos/${alunoId}/fichas/${data.id}`);
        router.refresh();
      },
      onError: (err) => {
        if (err.response?.status === 422) {
          setServerError(
            'Há campos inválidos no formulário. Revise e tente novamente.',
          );
          return;
        }
        if (err.response?.status === 404) {
          setServerError('Aluno não encontrado.');
          return;
        }
        setServerError('Não foi possível criar a ficha. Tente novamente.');
      },
    });
  }

  return (
    <FormShell
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isPending ? 'Criando...' : 'Criar ficha'}
      isPending={isPending}
      serverError={serverError}
      onCancel={onCancel ?? (() => router.back())}
    >
      <input type="hidden" {...register('aluno_id')} />
      <Field
        id="nome"
        label="Nome da ficha"
        required
        error={errors.nome?.message}
        placeholder="Ex: Hipertrofia — Maio/2026"
        registration={register('nome')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="vigencia_inicio"
          label="Vigência (início)"
          type="date"
          required
          error={errors.vigencia_inicio?.message}
          registration={register('vigencia_inicio')}
        />
        <Field
          id="vigencia_fim"
          label="Vigência (fim)"
          type="date"
          error={errors.vigencia_fim?.message}
          registration={register('vigencia_fim')}
          hint="Deixe em branco para vigência aberta."
        />
      </div>
    </FormShell>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────

function EditFichaForm({
  alunoId: _alunoId,
  fichaId,
  defaultValues,
  onCancel,
  onSaved,
}: {
  alunoId: string;
  fichaId: string;
  defaultValues: Partial<AtualizarFichaRequest>;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const { mutate, isPending } = useAtualizarFicha();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AtualizarFichaRequest>({
    resolver: zodResolver(AtualizarFichaRequestSchema),
    defaultValues: {
      nome: defaultValues.nome ?? '',
      vigencia_inicio: defaultValues.vigencia_inicio ?? '',
      vigencia_fim: defaultValues.vigencia_fim ?? '',
      ativa: defaultValues.ativa ?? true,
    } as DefaultValues<AtualizarFichaRequest>,
  });

  function onSubmit(values: AtualizarFichaRequest) {
    setServerError(null);
    setServerSuccess(null);
    mutate(
      { id: fichaId, payload: values },
      {
        onSuccess: () => {
          setServerSuccess('Alterações salvas com sucesso.');
          router.refresh();
          onSaved?.();
        },
        onError: (err) => {
          if (err.response?.status === 422) {
            setServerError(
              'Há campos inválidos no formulário. Revise e tente novamente.',
            );
            return;
          }
          setServerError(
            'Não foi possível salvar as alterações. Tente novamente.',
          );
        },
      },
    );
  }

  return (
    <FormShell
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isPending ? 'Salvando...' : 'Salvar alterações'}
      submitDisabled={!isDirty}
      isPending={isPending}
      serverError={serverError}
      serverSuccess={serverSuccess}
      onCancel={onCancel}
    >
      <Field
        id="nome"
        label="Nome da ficha"
        required
        error={errors.nome?.message}
        registration={register('nome')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="vigencia_inicio"
          label="Vigência (início)"
          type="date"
          error={errors.vigencia_inicio?.message}
          registration={register('vigencia_inicio')}
        />
        <Field
          id="vigencia_fim"
          label="Vigência (fim)"
          type="date"
          error={errors.vigencia_fim?.message}
          registration={register('vigencia_fim')}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-[--color-text]">
        <input
          type="checkbox"
          {...register('ativa')}
          className="h-4 w-4 rounded border-[--color-border] text-[--color-primary] focus:ring-[--color-primary]"
        />
        Ficha ativa
      </label>
    </FormShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Building blocks ───────────────────────────────────────────────────

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
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

type FormShellProps = {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submitDisabled?: boolean;
  isPending: boolean;
  serverError: string | null;
  serverSuccess?: string | null;
  onCancel?: () => void;
  children: React.ReactNode;
};

function FormShell({
  onSubmit,
  submitLabel,
  submitDisabled,
  isPending,
  serverError,
  serverSuccess,
  onCancel,
  children,
}: FormShellProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {children}

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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || submitDisabled}
          aria-busy={isPending}
          className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
