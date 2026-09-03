'use client';

import { useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  RegistrarAnamneseRequestSchema,
  type AnamneseResponse,
  type RegistrarAnamneseRequest,
} from '@amfit/shared';
import { useRegistrarAnamnese } from '../hooks/useRegistrarAnamnese';
import {
  OPCOES_FREQUENCIA_SEMANAL,
  OPCOES_EXPERIENCIA_MESES,
  OPCOES_OBJETIVO_SCORING,
  OPCOES_RESTRICOES,
  OPCOES_DISPONIBILIDADE,
} from '../lib/opcoes';

type Props = {
  alunoId: string;
  /**
   * Usado no fluxo de reavaliação: pré-preenche os campos de texto livre a
   * partir da anamnese já registrada. As 5 perguntas de scoring ficam em
   * branco de propósito — a resposta resolvida (`respostas.*.opcao`) que a
   * API devolve não é a chave original enviada, então não dá para
   * reconstruir a seleção anterior sem assumir pontos (o que o cliente
   * nunca faz); o personal reconfirma as respostas atuais a cada avaliação.
   */
  defaultValues?: Partial<RegistrarAnamneseRequest>;
  onSuccess: (resultado: AnamneseResponse) => void;
  onCancel?: () => void;
};

export function AnamneseForm({ alunoId, defaultValues, onSuccess, onCancel }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useRegistrarAnamnese();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegistrarAnamneseRequest>({
    resolver: zodResolver(RegistrarAnamneseRequestSchema),
    defaultValues: {
      objetivo: '',
      lesoes: '',
      doencas_preexistentes: '',
      medicamentos: '',
      pratica_outro_esporte: false,
      outro_esporte: '',
      frequencia_semanas_anterior: undefined,
      observacoes_gerais: '',
      respostas: {
        frequencia_semanal: '',
        experiencia_meses: '',
        objetivo: '',
        restricoes: '',
        disponibilidade: '',
      },
      ...defaultValues,
    } as DefaultValues<RegistrarAnamneseRequest>,
  });

  const praticaOutroEsporte = watch('pratica_outro_esporte');

  function onSubmit(values: RegistrarAnamneseRequest) {
    setServerError(null);
    mutate(
      { alunoId, payload: values },
      {
        onSuccess: (resultado) => onSuccess(resultado),
        onError: (err) => {
          if (err.response?.status === 404) {
            setServerError('Aluno não encontrado.');
            return;
          }
          if (err.response?.status === 422) {
            setServerError('Há campos inválidos no formulário. Revise e tente novamente.');
            return;
          }
          setServerError('Não foi possível salvar a anamnese. Tente novamente.');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[--color-text]">Sobre o aluno</legend>

        <Field
          id="anamnese-objetivo"
          label="Objetivo (descrição livre)"
          required
          placeholder="Ex: Ganhar massa magra"
          error={errors.objetivo?.message}
          registration={register('objetivo')}
        />

        <Textarea
          id="anamnese-lesoes"
          label="Lesões"
          error={errors.lesoes?.message}
          registration={register('lesoes')}
        />

        <Textarea
          id="anamnese-doencas"
          label="Doenças preexistentes"
          error={errors.doencas_preexistentes?.message}
          registration={register('doencas_preexistentes')}
        />

        <Textarea
          id="anamnese-medicamentos"
          label="Medicamentos em uso"
          error={errors.medicamentos?.message}
          registration={register('medicamentos')}
        />

        <label className="flex items-center gap-2 text-sm text-[--color-text]">
          <input
            type="checkbox"
            {...register('pratica_outro_esporte')}
            className="h-4 w-4 rounded border-[--color-border] text-[--color-primary] focus:ring-[--color-primary]"
          />
          Pratica outro esporte
        </label>

        {praticaOutroEsporte && (
          <Field
            id="anamnese-outro-esporte"
            label="Qual esporte?"
            error={errors.outro_esporte?.message}
            registration={register('outro_esporte')}
          />
        )}

        <NumberField
          id="anamnese-frequencia-anterior"
          label="Dias por semana que treinava antes (0-7)"
          error={errors.frequencia_semanas_anterior?.message}
          registration={register('frequencia_semanas_anterior', {
            setValueAs: (v: unknown) =>
              v === '' || v === null || v === undefined ? undefined : Number(v),
          })}
        />

        <Textarea
          id="anamnese-observacoes"
          label="Observações gerais"
          error={errors.observacoes_gerais?.message}
          registration={register('observacoes_gerais')}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[--color-text]">
          Avaliação inicial (define o nível sugerido)
        </legend>

        <SelectField
          id="anamnese-frequencia-semanal"
          label="Frequência de treino atual"
          required
          options={OPCOES_FREQUENCIA_SEMANAL}
          error={errors.respostas?.frequencia_semanal?.message}
          registration={register('respostas.frequencia_semanal')}
        />

        <SelectField
          id="anamnese-experiencia-meses"
          label="Experiência com treino"
          required
          options={OPCOES_EXPERIENCIA_MESES}
          error={errors.respostas?.experiencia_meses?.message}
          registration={register('respostas.experiencia_meses')}
        />

        <SelectField
          id="anamnese-objetivo-scoring"
          label="Objetivo principal"
          required
          options={OPCOES_OBJETIVO_SCORING}
          error={errors.respostas?.objetivo?.message}
          registration={register('respostas.objetivo')}
        />

        <SelectField
          id="anamnese-restricoes"
          label="Possui restrições médicas ou lesões que limitam exercícios?"
          required
          options={OPCOES_RESTRICOES}
          error={errors.respostas?.restricoes?.message}
          registration={register('respostas.restricoes')}
        />

        <SelectField
          id="anamnese-disponibilidade"
          label="Disponibilidade semanal para treinar"
          required
          options={OPCOES_DISPONIBILIDADE}
          error={errors.respostas?.disponibilidade?.message}
          registration={register('respostas.disponibilidade')}
        />
      </fieldset>

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
          {isPending ? 'Salvando...' : 'Salvar anamnese'}
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

// ── Building blocks ─────────────────────────────────────────────────

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Field({ id, label, required, error, placeholder, registration }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[--color-text]">
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

type NumberFieldProps = Omit<FieldProps, 'placeholder'>;

function NumberField({ id, label, required, error, registration }: NumberFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[--color-text]">
        {label}
        {required && ' *'}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={7}
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
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function Textarea({ id, label, error, registration }: TextareaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[--color-text]">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        aria-invalid={!!error}
        aria-describedby={errorId}
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

type SelectFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  options: { value: string; label: string }[];
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function SelectField({ id, label, required, error, options, registration }: SelectFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[--color-text]">
        {label}
        {required && ' *'}
      </label>
      <select
        id={id}
        aria-required={required ? 'true' : undefined}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        {...registration}
      >
        <option value="">Selecione...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
    </div>
  );
}
