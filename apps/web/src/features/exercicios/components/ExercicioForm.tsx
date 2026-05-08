'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  AtualizarExercicioRequestSchema,
  CriarExercicioRequestSchema,
  TIPO_MIDIA,
  type AtualizarExercicioRequest,
  type CriarExercicioRequest,
  type TipoMidia,
} from '@amfit/shared';
import { useCriarExercicio } from '../hooks/useCriarExercicio';
import { useAtualizarExercicio } from '../hooks/useAtualizarExercicio';
import { useGruposMusculares } from '../hooks/useGruposMusculares';
import { MidiaPreview } from './MidiaPreview';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIDIA = 'image/jpeg,image/png,image/gif,image/webp,video/mp4';

type CreateProps = {
  mode: 'create';
  defaultValues?: Partial<CriarExercicioRequest>;
};

type EditProps = {
  mode: 'edit';
  exercicioId: string;
  defaultValues: Partial<AtualizarExercicioRequest>;
  readOnly?: boolean;
};

type Props = CreateProps | EditProps;

export function ExercicioForm(props: Props) {
  if (props.mode === 'create') {
    return <CreateExercicioForm defaultValues={props.defaultValues} />;
  }
  return (
    <EditExercicioForm
      exercicioId={props.exercicioId}
      defaultValues={props.defaultValues}
      readOnly={props.readOnly}
    />
  );
}

// ── Create ─────────────────────────────────────────────────────────

function CreateExercicioForm({
  defaultValues,
}: {
  defaultValues?: Partial<CriarExercicioRequest>;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [midia, setMidia] = useState<File | null>(null);
  const [midiaError, setMidiaError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTipo, setPreviewTipo] = useState<TipoMidia | null>(null);

  const { mutate, isPending } = useCriarExercicio();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CriarExercicioRequest>({
    resolver: zodResolver(CriarExercicioRequestSchema),
    defaultValues: {
      nome: '',
      grupo_muscular_id: '',
      descricao: '',
      ...defaultValues,
    } as DefaultValues<CriarExercicioRequest>,
  });

  useEffect(() => {
    if (!midia) {
      setPreviewUrl(null);
      setPreviewTipo(null);
      return;
    }
    const url = URL.createObjectURL(midia);
    setPreviewUrl(url);
    setPreviewTipo(detectTipoMidia(midia));
    return () => URL.revokeObjectURL(url);
  }, [midia]);

  function handleMidiaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setMidiaError(null);

    if (!file) {
      setMidia(null);
      return;
    }

    const validation = validateMidia(file);
    if (!validation.ok) {
      setMidiaError(validation.message);
      setMidia(null);
      // limpa o input para permitir reseleção do mesmo arquivo
      e.target.value = '';
      return;
    }

    setMidia(file);
  }

  function onSubmit(values: CriarExercicioRequest) {
    setServerError(null);
    if (midiaError) return;

    mutate(
      { data: values, midia },
      {
        onSuccess: () => {
          router.replace('/exercicios');
          router.refresh();
        },
        onError: (err) => {
          if (err.response?.status === 422) {
            const data = err.response.data as
              | { errors?: Record<string, string> }
              | undefined;
            if (data?.errors) {
              for (const [field, message] of Object.entries(data.errors)) {
                if (
                  field === 'nome' ||
                  field === 'descricao' ||
                  field === 'grupo_muscular_id'
                ) {
                  setError(field, { message });
                }
              }
              setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
              return;
            }
            setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
            return;
          }
          if (err.response?.status === 413) {
            setMidiaError('Arquivo de mídia excede o tamanho máximo permitido.');
            return;
          }
          setServerError('Não foi possível cadastrar o exercício. Tente novamente.');
        },
      },
    );
  }

  return (
    <FormShell
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isPending ? 'Cadastrando...' : 'Cadastrar exercício'}
      isPending={isPending}
      serverError={serverError}
      onCancel={() => router.back()}
    >
      <Field
        id="nome"
        label="Nome do exercício"
        required
        error={errors.nome?.message}
        placeholder="Ex: Supino reto"
        registration={register('nome')}
      />
      <GrupoMuscularSelect
        id="grupo_muscular_id"
        required
        error={errors.grupo_muscular_id?.message}
        registration={register('grupo_muscular_id')}
      />
      <Textarea
        id="descricao"
        label="Descrição"
        error={errors.descricao?.message}
        placeholder="Instruções de execução, dicas, observações..."
        registration={register('descricao')}
      />
      <MidiaUpload
        midia={midia}
        previewUrl={previewUrl}
        previewTipo={previewTipo}
        error={midiaError}
        onChange={handleMidiaChange}
        onClear={() => {
          setMidia(null);
          setMidiaError(null);
        }}
      />
    </FormShell>
  );
}

// ── Edit ───────────────────────────────────────────────────────────

function EditExercicioForm({
  exercicioId,
  defaultValues,
  readOnly,
}: {
  exercicioId: string;
  defaultValues: Partial<AtualizarExercicioRequest>;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const { mutate, isPending } = useAtualizarExercicio();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<AtualizarExercicioRequest>({
    resolver: zodResolver(AtualizarExercicioRequestSchema),
    defaultValues: {
      nome: defaultValues.nome ?? '',
      grupo_muscular_id: defaultValues.grupo_muscular_id ?? '',
      descricao: defaultValues.descricao ?? '',
    } as DefaultValues<AtualizarExercicioRequest>,
  });

  function onSubmit(values: AtualizarExercicioRequest) {
    setServerError(null);
    setServerSuccess(null);

    mutate(
      { id: exercicioId, payload: values },
      {
        onSuccess: () => {
          setServerSuccess('Alterações salvas com sucesso.');
          router.refresh();
        },
        onError: (err) => {
          if (err.response?.status === 422) {
            const data = err.response.data as
              | { errors?: Record<string, string> }
              | undefined;
            if (data?.errors) {
              for (const [field, message] of Object.entries(data.errors)) {
                if (
                  field === 'nome' ||
                  field === 'descricao' ||
                  field === 'grupo_muscular_id'
                ) {
                  setError(field, { message });
                }
              }
            }
            setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
            return;
          }
          if (err.response?.status === 403) {
            setServerError('Exercícios globais não podem ser editados.');
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
      submitDisabled={!isDirty || readOnly}
      isPending={isPending}
      serverError={serverError}
      serverSuccess={serverSuccess}
    >
      {readOnly && (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-[--color-warning]"
        >
          Este exercício é global e não pode ser editado.
        </p>
      )}
      <Field
        id="nome"
        label="Nome do exercício"
        required
        error={errors.nome?.message}
        registration={register('nome')}
        disabled={readOnly}
      />
      <GrupoMuscularSelect
        id="grupo_muscular_id"
        required
        error={errors.grupo_muscular_id?.message}
        registration={register('grupo_muscular_id')}
        disabled={readOnly}
      />
      <Textarea
        id="descricao"
        label="Descrição"
        error={errors.descricao?.message}
        registration={register('descricao')}
        disabled={readOnly}
      />
    </FormShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function detectTipoMidia(file: File): TipoMidia | null {
  if (file.type === 'video/mp4') return TIPO_MIDIA.VIDEO;
  if (file.type === 'image/gif') return TIPO_MIDIA.GIF;
  if (file.type.startsWith('image/')) return TIPO_MIDIA.IMAGEM;
  return null;
}

function validateMidia(
  file: File,
): { ok: true } | { ok: false; message: string } {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type === 'video/mp4';

  if (!isImage && !isVideo) {
    return {
      ok: false,
      message: 'Formato não suportado. Envie imagem (JPG, PNG, GIF, WebP) ou vídeo MP4.',
    };
  }

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'Imagem excede o tamanho máximo de 5MB.' };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false, message: 'Vídeo excede o tamanho máximo de 10MB.' };
  }

  return { ok: true };
}

// ── Building blocks ────────────────────────────────────────────────

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Field({
  id,
  label,
  type = 'text',
  required,
  error,
  placeholder,
  disabled,
  registration,
}: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
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
        aria-describedby={errorId}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-60"
        {...registration}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
    </div>
  );
}

type TextareaProps = {
  id: string;
  label: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Textarea({
  id,
  label,
  error,
  placeholder,
  disabled,
  registration,
}: TextareaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-[--color-text]"
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-60"
        {...registration}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
    </div>
  );
}

type GrupoMuscularSelectProps = {
  id: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function GrupoMuscularSelect({
  id,
  required,
  error,
  disabled,
  registration,
}: GrupoMuscularSelectProps) {
  const { data: grupos, isLoading, isError } = useGruposMusculares();
  const errorId = error ? `${id}-error` : undefined;
  const isDisabled = disabled || isLoading || isError;

  const helperText = useMemo(() => {
    if (isLoading) return 'Carregando grupos musculares...';
    if (isError) return 'Não foi possível carregar os grupos musculares.';
    return null;
  }, [isLoading, isError]);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-[--color-text]"
      >
        Grupo muscular
        {required && ' *'}
      </label>
      <select
        id={id}
        aria-required={required ? 'true' : undefined}
        aria-invalid={!!error}
        aria-describedby={errorId}
        disabled={isDisabled}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-60"
        {...registration}
      >
        <option value="">Selecione um grupo</option>
        {grupos?.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      ) : helperText ? (
        <p
          className={
            isError
              ? 'mt-1 text-xs text-[--color-danger]'
              : 'mt-1 text-xs text-[--color-text-muted]'
          }
          role={isError ? 'alert' : undefined}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

type MidiaUploadProps = {
  midia: File | null;
  previewUrl: string | null;
  previewTipo: TipoMidia | null;
  error: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
};

function MidiaUpload({
  midia,
  previewUrl,
  previewTipo,
  error,
  onChange,
  onClear,
}: MidiaUploadProps) {
  const errorId = error ? 'midia-error' : undefined;
  return (
    <div>
      <label
        htmlFor="midia"
        className="mb-1 block text-sm font-medium text-[--color-text]"
      >
        Mídia (imagem ou vídeo)
      </label>
      <input
        id="midia"
        name="midia"
        type="file"
        accept={ACCEPTED_MIDIA}
        onChange={onChange}
        aria-invalid={!!error}
        aria-describedby={errorId ?? 'midia-hint'}
        className="block w-full text-sm text-[--color-text] file:mr-3 file:rounded-md file:border-0 file:bg-[--color-bg-muted] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[--color-text] hover:file:bg-[--color-border]"
      />
      <p id="midia-hint" className="mt-1 text-xs text-[--color-text-muted]">
        Imagens até 5MB (JPG, PNG, GIF, WebP) ou vídeos MP4 até 10MB.
      </p>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
      {midia && previewUrl && (
        <div className="mt-3 space-y-2">
          <div className="aspect-video w-full max-w-sm overflow-hidden rounded-md border border-[--color-border] bg-[--color-bg-muted]">
            <MidiaPreview
              url={previewUrl}
              tipo={previewTipo}
              alt={`Pré-visualização de ${midia.name}`}
              controls
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-[--color-text-muted]">
            <span>{midia.name}</span>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-[--color-border] px-2 py-1 text-xs font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
            >
              Remover
            </button>
          </div>
        </div>
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
