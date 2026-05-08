'use client';

import { useState } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldErrors,
  type Path,
  type RegisterOptions,
  type UseFormRegister,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AtualizarItemTreinoRequestSchema,
  CriarItemTreinoRequestSchema,
  type AtualizarItemTreinoRequest,
  type CriarItemTreinoRequest,
  type ExercicioResponse,
  type ItemTreinoResponse,
} from '@amfit/shared';
import { MidiaPreview } from '@/features/exercicios/components/MidiaPreview';
import { useCriarItem } from '../hooks/useCriarItem';
import { useAtualizarItem } from '../hooks/useAtualizarItem';
import { ExercicioSelector } from './ExercicioSelector';

/**
 * Shape compartilhado entre Create e Edit forms — somente os campos
 * que aparecem em ambos os schemas com o mesmo tipo, usado para o
 * helper genérico ParametrosFields.
 */
type ParametrosShared = {
  series?: number;
  repeticoes?: string;
  carga_sugerida?: number | null;
  descanso_segundos?: number | null;
  observacao?: string | null;
};

type CreateProps = {
  mode: 'create';
  fichaId: string;
  treinoId: string;
  ordem: number;
  onSuccess: () => void;
  onCancel: () => void;
};

type EditProps = {
  mode: 'edit';
  fichaId: string;
  item: ItemTreinoResponse;
  onSuccess: () => void;
  onCancel: () => void;
};

type Props = CreateProps | EditProps;

export function ItemTreinoForm(props: Props) {
  if (props.mode === 'create') {
    return (
      <CreateItemForm
        fichaId={props.fichaId}
        treinoId={props.treinoId}
        ordem={props.ordem}
        onSuccess={props.onSuccess}
        onCancel={props.onCancel}
      />
    );
  }
  return (
    <EditItemForm
      fichaId={props.fichaId}
      item={props.item}
      onSuccess={props.onSuccess}
      onCancel={props.onCancel}
    />
  );
}

// ── Create ────────────────────────────────────────────────────────────

function CreateItemForm({
  fichaId,
  treinoId,
  ordem,
  onSuccess,
  onCancel,
}: {
  fichaId: string;
  treinoId: string;
  ordem: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [exercicio, setExercicio] = useState<ExercicioResponse | null>(null);
  const [exercicioError, setExercicioError] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const { mutate, isPending } = useCriarItem();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CriarItemTreinoRequest>({
    resolver: zodResolver(CriarItemTreinoRequestSchema),
    defaultValues: {
      exercicio_id: '',
      ordem,
      series: 3,
      repeticoes: '8-12',
      carga_sugerida: undefined,
      descanso_segundos: undefined,
      observacao: '',
    } as DefaultValues<CriarItemTreinoRequest>,
  });

  function handleSelectExercicio(ex: ExercicioResponse) {
    setExercicio(ex);
    setExercicioError(null);
    setValue('exercicio_id', ex.id, { shouldValidate: true });
    setSelectorOpen(false);
  }

  function handleClearExercicio() {
    setExercicio(null);
    setValue('exercicio_id', '' as unknown as CriarItemTreinoRequest['exercicio_id']);
  }

  function onSubmit(values: CriarItemTreinoRequest) {
    setServerError(null);
    if (!exercicio) {
      setExercicioError('Selecione um exercício antes de salvar.');
      return;
    }

    const payload: CriarItemTreinoRequest = {
      ...values,
      exercicio_id: exercicio.id,
      ordem,
    };

    mutate(
      { fichaId, treinoId, payload },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          if (err.response?.status === 422) {
            setServerError(
              'Há campos inválidos. Revise e tente novamente.',
            );
            return;
          }
          setServerError('Não foi possível adicionar o exercício. Tente novamente.');
        },
      },
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <input type="hidden" {...register('exercicio_id')} />

        <ExercicioPicker
          exercicio={exercicio}
          error={exercicioError ?? errors.exercicio_id?.message}
          onPick={() => {
            setExercicioError(null);
            setSelectorOpen(true);
          }}
          onClear={handleClearExercicio}
        />

        <ParametrosFields register={register} errors={errors} />

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
            {isPending ? 'Adicionando...' : 'Adicionar exercício'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>

      <ExercicioSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelectExercicio}
      />
    </>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────

function EditItemForm({
  fichaId,
  item,
  onSuccess,
  onCancel,
}: {
  fichaId: string;
  item: ItemTreinoResponse;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useAtualizarItem();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AtualizarItemTreinoRequest>({
    resolver: zodResolver(AtualizarItemTreinoRequestSchema),
    defaultValues: {
      series: item.series,
      repeticoes: item.repeticoes,
      carga_sugerida: item.carga_sugerida ?? undefined,
      descanso_segundos: item.descanso_segundos ?? undefined,
      observacao: item.observacao ?? '',
    } as DefaultValues<AtualizarItemTreinoRequest>,
  });

  function onSubmit(values: AtualizarItemTreinoRequest) {
    setServerError(null);
    mutate(
      { fichaId, itemId: item.id, payload: values },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          if (err.response?.status === 422) {
            setServerError(
              'Há campos inválidos. Revise e tente novamente.',
            );
            return;
          }
          setServerError('Não foi possível salvar as alterações. Tente novamente.');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <ExercicioPicker exercicio={item.exercicio} readOnly />

      <ParametrosFields register={register} errors={errors} />

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
          disabled={isPending || !isDirty}
          aria-busy={isPending}
          className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-[--color-border] bg-[--color-bg] px-4 py-2 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Building blocks ───────────────────────────────────────────────────

type ExercicioPickerProps =
  | {
      exercicio: ExercicioResponse | null;
      error?: string;
      onPick: () => void;
      onClear: () => void;
      readOnly?: false;
    }
  | {
      exercicio: ExercicioResponse;
      readOnly: true;
    };

function ExercicioPicker(props: ExercicioPickerProps) {
  const exercicio = props.exercicio;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-[--color-text]">
        Exercício {!props.readOnly && '*'}
      </span>

      {exercicio ? (
        <div className="flex items-center gap-3 rounded-md border border-[--color-border] bg-[--color-bg-subtle] p-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-[--color-bg-muted]">
            <MidiaPreview
              url={exercicio.midia_url}
              tipo={exercicio.tipo_midia}
              alt={exercicio.nome}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-[--color-text]">
              {exercicio.nome}
            </p>
            <p className="truncate text-xs text-[--color-text-muted]">
              {exercicio.grupo_muscular.nome}
            </p>
          </div>
          {!props.readOnly && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={props.onPick}
                className="rounded-md border border-[--color-border] bg-[--color-bg] px-2 py-1 text-xs font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={props.onClear}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-[--color-danger] hover:bg-red-50"
              >
                Limpar
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={!props.readOnly ? props.onPick : undefined}
          aria-invalid={!!('error' in props && props.error)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[--color-border] bg-[--color-bg] px-3 py-4 text-sm font-medium text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
        >
          Selecionar exercício
        </button>
      )}

      {!props.readOnly && props.error && (
        <p role="alert" className="mt-1 text-xs text-[--color-danger]">
          {props.error}
        </p>
      )}
    </div>
  );
}

type ParametrosFieldsProps<T extends ParametrosShared> = {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
};

function ParametrosFields<T extends ParametrosShared>({
  register,
  errors,
}: ParametrosFieldsProps<T>) {
  // Casts of the field path: T extends ParametrosShared, so each
  // shared key is a valid Path<T> at runtime — TS conservatively
  // requires a cast because of variance.
  const seriesPath = 'series' as Path<T>;
  const repeticoesPath = 'repeticoes' as Path<T>;
  const cargaPath = 'carga_sugerida' as Path<T>;
  const descansoPath = 'descanso_segundos' as Path<T>;
  const observacaoPath = 'observacao' as Path<T>;

  const numericOptional: RegisterOptions<T, Path<T>> = {
    setValueAs: (v: unknown) =>
      v === '' || v === null || v === undefined ? null : Number(v),
  } as RegisterOptions<T, Path<T>>;

  const seriesError = (errors as FieldErrors<ParametrosShared>).series?.message;
  const repeticoesError = (errors as FieldErrors<ParametrosShared>).repeticoes
    ?.message;
  const cargaError = (errors as FieldErrors<ParametrosShared>).carga_sugerida
    ?.message;
  const descansoError = (errors as FieldErrors<ParametrosShared>)
    .descanso_segundos?.message;
  const observacaoError = (errors as FieldErrors<ParametrosShared>).observacao
    ?.message;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id="series"
          label="Séries"
          required
          error={seriesError}
          registration={register(seriesPath, {
            valueAsNumber: true,
          } as RegisterOptions<T, Path<T>>)}
        />
        <Field
          id="repeticoes"
          label="Repetições"
          required
          placeholder='Ex: "8-12", "AMRAP", "30s"'
          error={repeticoesError}
          registration={register(repeticoesPath)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id="carga_sugerida"
          label="Carga sugerida (kg)"
          step="0.5"
          error={cargaError}
          registration={register(cargaPath, numericOptional)}
        />
        <NumberField
          id="descanso_segundos"
          label="Descanso (segundos)"
          step="5"
          error={descansoError}
          registration={register(descansoPath, numericOptional)}
        />
      </div>

      <Textarea
        id="observacao"
        label="Observação"
        placeholder="Cadência, técnica, dicas..."
        error={observacaoError}
        registration={register(observacaoPath)}
      />
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Field({
  id,
  label,
  required,
  placeholder,
  error,
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
        type="text"
        aria-required={required ? 'true' : undefined}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={placeholder}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
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

type NumberFieldProps = FieldProps & { step?: string };

function NumberField({
  id,
  label,
  required,
  step,
  error,
  registration,
}: NumberFieldProps) {
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
        type="number"
        inputMode="decimal"
        step={step}
        aria-required={required ? 'true' : undefined}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
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
  placeholder?: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Textarea({
  id,
  label,
  placeholder,
  error,
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
        rows={3}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={placeholder}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
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
