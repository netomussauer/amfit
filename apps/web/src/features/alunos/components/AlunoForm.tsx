'use client';

import { useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  AtualizarAlunoRequestSchema,
  CriarAlunoRequestSchema,
  type AtualizarAlunoRequest,
  type CriarAlunoRequest,
} from '@amfit/shared';
import { useCriarAluno } from '../hooks/useCriarAluno';
import { useAtualizarAluno } from '../hooks/useAtualizarAluno';

type CreateProps = {
  mode: 'create';
  defaultValues?: Partial<CriarAlunoRequest>;
};

type EditProps = {
  mode: 'edit';
  alunoId: string;
  defaultValues: Partial<AtualizarAlunoRequest>;
};

type Props = CreateProps | EditProps;

export function AlunoForm(props: Props) {
  if (props.mode === 'create') {
    return <CreateAlunoForm defaultValues={props.defaultValues} />;
  }
  return <EditAlunoForm alunoId={props.alunoId} defaultValues={props.defaultValues} />;
}

function CreateAlunoForm({ defaultValues }: { defaultValues?: Partial<CriarAlunoRequest> }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useCriarAluno();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CriarAlunoRequest>({
    resolver: zodResolver(CriarAlunoRequestSchema),
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      telefone: '',
      data_nascimento: '',
      ...defaultValues,
    } as DefaultValues<CriarAlunoRequest>,
  });

  function onSubmit(values: CriarAlunoRequest) {
    setServerError(null);
    mutate(values, {
      onSuccess: () => {
        router.replace('/alunos');
        router.refresh();
      },
      onError: (err) => {
        if (err.response?.status === 409) {
          setError('email', { message: 'Este e-mail já está cadastrado' });
          return;
        }
        if (err.response?.status === 422) {
          setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
          return;
        }
        setServerError('Não foi possível cadastrar o aluno. Tente novamente.');
      },
    });
  }

  return (
    <FormShell
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isPending ? 'Cadastrando...' : 'Cadastrar aluno'}
      isPending={isPending}
      serverError={serverError}
      onCancel={() => router.back()}
    >
      <Field
        id="nome"
        label="Nome completo"
        required
        error={errors.nome?.message}
        autoComplete="name"
        registration={register('nome')}
        placeholder="João Silva"
      />
      <Field
        id="email"
        label="E-mail"
        type="email"
        required
        error={errors.email?.message}
        autoComplete="email"
        registration={register('email')}
        placeholder="aluno@email.com"
      />
      <Field
        id="senha"
        label="Senha"
        type="password"
        required
        error={errors.senha?.message}
        autoComplete="new-password"
        registration={register('senha')}
        placeholder="••••••••"
        hint="Mínimo de 8 caracteres."
      />
      <Field
        id="telefone"
        label="Telefone"
        type="tel"
        error={errors.telefone?.message}
        autoComplete="tel"
        registration={register('telefone')}
        placeholder="(11) 99999-9999"
      />
      <Field
        id="data_nascimento"
        label="Data de nascimento"
        type="date"
        error={errors.data_nascimento?.message}
        registration={register('data_nascimento')}
      />
      <SexoSelect
        id="sexo"
        error={errors.sexo?.message}
        registration={register('sexo')}
      />
    </FormShell>
  );
}

function EditAlunoForm({
  alunoId,
  defaultValues,
}: {
  alunoId: string;
  defaultValues: Partial<AtualizarAlunoRequest>;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const { mutate, isPending } = useAtualizarAluno();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<AtualizarAlunoRequest>({
    resolver: zodResolver(AtualizarAlunoRequestSchema),
    defaultValues: {
      nome: defaultValues.nome ?? '',
      email: defaultValues.email ?? '',
      telefone: defaultValues.telefone ?? '',
      data_nascimento: defaultValues.data_nascimento ?? '',
      sexo: defaultValues.sexo,
    } as DefaultValues<AtualizarAlunoRequest>,
  });

  function onSubmit(values: AtualizarAlunoRequest) {
    setServerError(null);
    setServerSuccess(null);
    mutate(
      { id: alunoId, payload: values },
      {
        onSuccess: () => {
          setServerSuccess('Alterações salvas com sucesso.');
          router.refresh();
        },
        onError: (err) => {
          if (err.response?.status === 409) {
            setError('email', { message: 'Este e-mail já está em uso' });
            return;
          }
          if (err.response?.status === 422) {
            setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
            return;
          }
          setServerError('Não foi possível salvar as alterações. Tente novamente.');
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
    >
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
        id="data_nascimento"
        label="Data de nascimento"
        type="date"
        error={errors.data_nascimento?.message}
        registration={register('data_nascimento')}
      />
      <SexoSelect
        id="sexo"
        error={errors.sexo?.message}
        registration={register('sexo')}
      />
    </FormShell>
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

type SexoSelectProps = {
  id: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function SexoSelect({ id, error, registration }: SexoSelectProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-[--color-text]"
      >
        Sexo
      </label>
      <select
        id={id}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        {...registration}
      >
        <option value="">Não informado</option>
        <option value="M">Masculino</option>
        <option value="F">Feminino</option>
        <option value="OUTRO">Outro</option>
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
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
