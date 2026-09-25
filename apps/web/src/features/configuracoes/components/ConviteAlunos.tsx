'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CopyButton } from '@/shared/components/CopyButton';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { useRegenerarCodigoTenant } from '../hooks/useRegenerarCodigoTenant';

// Convite para alunos (ADR-007, nível 2): o personal compartilha o código, o
// link web (`/entrar/<codigo>`) ou o QR desse link; o aluno vê a marca do
// personal já no login.
export function ConviteAlunos() {
  const { data: config, isLoading, isError, refetch } = useTenantConfig();
  const { mutate, reset, isPending, isError: falhouRegenerar } = useRegenerarCodigoTenant();
  const [confirmando, setConfirmando] = useState(false);
  // window só existe no navegador; ler depois do mount evita divergência de
  // hidratação entre servidor e cliente.
  const [origem, setOrigem] = useState('');

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  if (isLoading) {
    return <p className="text-sm text-[--color-text-muted]">Carregando convite...</p>;
  }

  if (isError || !config) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar o convite.
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

  const codigo = config.codigo;
  if (!codigo) {
    return (
      <p className="text-sm text-[--color-text-muted]">
        O código de convite ainda não está disponível. Tente novamente em instantes.
      </p>
    );
  }

  const link = origem ? `${origem}/entrar/${codigo}` : '';
  const deepLink = `amfit://entrar/${codigo}`;

  function abrirConfirmacao() {
    reset();
    setConfirmando(true);
  }

  function cancelarConfirmacao() {
    reset();
    setConfirmando(false);
  }

  // Só fecha o diálogo no sucesso: numa falha ele continua aberto, com o
  // erro à vista, para tentar de novo ou cancelar.
  function confirmarNovoCodigo() {
    mutate(undefined, { onSuccess: () => setConfirmando(false) });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {link ? (
          <div
            className="shrink-0 rounded-md border border-[--color-border] bg-white p-3"
            role="img"
            aria-label="QR code do link de convite"
          >
            <QRCodeSVG value={link} size={144} level="M" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
              Código de convite
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span
                data-testid="codigo-convite"
                className="font-mono text-2xl font-bold tracking-widest text-[--color-text]"
              >
                {codigo}
              </span>
              <CopyButton text={codigo} label="Copiar código" />
            </div>
          </div>

          {link ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
                Link de convite
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="break-all text-sm text-[--color-text]">{link}</span>
                <CopyButton text={link} label="Copiar link" />
              </div>
            </div>
          ) : null}

          {link ? (
            <p className="text-xs text-[--color-text-muted]">
              O link e o QR usam o endereço que você está acessando agora ({origem}). Confira se
              seus alunos conseguem abrir esse endereço.
            </p>
          ) : null}

          <p className="text-xs text-[--color-text-muted]">
            No app, o aluno abre <span className="font-mono">{deepLink}</span> ou digita o código em
            &quot;Tenho um código do meu personal&quot;.
          </p>
        </div>
      </div>

      <div className="border-t border-[--color-border] pt-4">
        {confirmando ? (
          <div role="alertdialog" aria-label="Confirmar novo código" className="space-y-3">
            <p className="text-sm text-[--color-text]">
              O link e o QR atuais deixam de funcionar. Quem ainda não entrou precisará do novo
              convite. Continuar?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmarNovoCodigo}
                disabled={isPending}
                className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:bg-[--color-primary-hover] disabled:opacity-60"
              >
                {isPending ? 'Gerando...' : 'Gerar novo código'}
              </button>
              <button
                type="button"
                onClick={cancelarConfirmacao}
                disabled={isPending}
                className="rounded-md border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted] disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={abrirConfirmacao}
            className="rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Gerar novo código
          </button>
        )}

        {falhouRegenerar ? (
          <p role="alert" className="mt-3 text-sm text-[--color-danger]">
            Não foi possível gerar um novo código. Confira o código exibido e tente de novo.
          </p>
        ) : null}
      </div>
    </div>
  );
}
