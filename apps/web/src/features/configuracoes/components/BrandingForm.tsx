'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AtualizarTenantConfigRequestSchema,
  type AtualizarTenantConfigRequest,
  type TenantConfigResponse,
} from '@amfit/shared';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { useAtualizarTenantConfig } from '../hooks/useAtualizarTenantConfig';

const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const TIPOS_LOGO_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png'];

export function BrandingForm() {
  const { data: config, isLoading, isError, refetch } = useTenantConfig();

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">
        Carregando configuração de marca...
      </p>
    );
  }

  if (isError || !config) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar a configuração de marca.
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

  return <EditBrandingForm config={config} />;
}

function EditBrandingForm({ config }: { config: TenantConfigResponse }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(config.logo_url ?? null);
  // Só a URL de blob local (gerada por URL.createObjectURL) precisa ser
  // revogada — a URL remota inicial (config.logo_url) não. Rastreada à
  // parte pra saber exatamente o que revogar e quando (achado de
  // code-review: sem isso, cada arquivo escolhido vazava a URL de blob
  // anterior pelo resto da vida da página).
  const blobUrlRef = useRef<string | null>(null);
  const { mutate, isPending } = useAtualizarTenantConfig();

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AtualizarTenantConfigRequest>({
    resolver: zodResolver(AtualizarTenantConfigRequestSchema),
    defaultValues: {
      cor_primaria: config.cor_primaria,
      cor_secundaria: config.cor_secundaria,
      nome_app: config.nome_app ?? '',
    },
  });

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoError(null);
    if (!file) {
      setLogoFile(null);
      return;
    }
    if (!TIPOS_LOGO_ACEITOS.includes(file.type)) {
      setLogoError('Formato não suportado — use JPEG ou PNG.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Arquivo muito grande — máximo de 4 MB.');
      e.target.value = '';
      return;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    blobUrlRef.current = nextUrl;

    setLogoFile(file);
    setPreviewUrl(nextUrl);
  }

  function onSubmit(values: AtualizarTenantConfigRequest) {
    setServerError(null);
    setServerSuccess(null);

    mutate(
      { payload: values, logo: logoFile },
      {
        onSuccess: () => {
          setServerSuccess('Marca atualizada com sucesso.');
          setLogoFile(null);
        },
        onError: () => {
          setServerError('Não foi possível salvar as alterações. Tente novamente.');
        },
      },
    );
  }

  const podeSalvar = isDirty || logoFile !== null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <span className="mb-1 block text-sm font-medium text-[--color-text]">Logo</span>
        <div className="flex items-center gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo remoto (MinIO) ou blob local de preview, next/image exigiria domínio configurado à parte
            <img
              src={previewUrl}
              alt="Preview do logo"
              className="h-16 w-16 rounded-lg border border-[--color-border] object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[--color-border] text-center text-xs text-[--color-text-muted]">
              Sem logo
            </div>
          )}
          <label className="cursor-pointer rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]">
            Escolher arquivo
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleLogoChange}
            />
          </label>
        </div>
        {logoError && (
          <p role="alert" className="mt-1 text-xs text-[--color-danger]">
            {logoError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ColorField
          id="cor_primaria"
          label="Cor primária"
          error={errors.cor_primaria?.message}
          registration={register('cor_primaria')}
        />
        <ColorField
          id="cor_secundaria"
          label="Cor secundária"
          error={errors.cor_secundaria?.message}
          registration={register('cor_secundaria')}
        />
      </div>

      <div>
        <label
          htmlFor="nome_app"
          className="mb-1 block text-sm font-medium text-[--color-text]"
        >
          Nome do app
        </label>
        <input
          id="nome_app"
          type="text"
          placeholder="AMFIT"
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
          {...register('nome_app')}
        />
        {errors.nome_app && (
          <p role="alert" className="mt-1 text-xs text-[--color-danger]">
            {errors.nome_app.message}
          </p>
        )}
      </div>

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
        disabled={isPending || !podeSalvar}
        aria-busy={isPending}
        className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  );
}

// ── building blocks ─────────────────────────────────────────────────

type ColorFieldProps = {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
};

function ColorField({ id, label, error, registration }: ColorFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[--color-text]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        maxLength={6}
        placeholder="f97316"
        aria-invalid={!!error}
        className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        {...registration}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-[--color-danger]">
          {error}
        </p>
      )}
    </div>
  );
}
