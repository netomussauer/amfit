import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfigResponse } from '@amfit/shared';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { useRegenerarCodigoTenant } from '../hooks/useRegenerarCodigoTenant';
import { ConviteAlunos } from './ConviteAlunos';

vi.mock('../hooks/useTenantConfig');
vi.mock('../hooks/useRegenerarCodigoTenant');

const mockedUseTenantConfig = vi.mocked(useTenantConfig);
const mockedUseRegenerar = vi.mocked(useRegenerarCodigoTenant);

const CODIGO = 'K7M2QX9P';

const configFixture: TenantConfigResponse = {
  cor_primaria: 'f97316',
  cor_secundaria: 'ea580c',
  nome_app: 'Studio X',
  codigo: CODIGO,
};

function mockConfig(overrides: Partial<ReturnType<typeof useTenantConfig>>) {
  mockedUseTenantConfig.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTenantConfig>);
}

// `mutate` simula sucesso por padrão (chama onSuccess); passe `sucesso: false`
// para simular falha (não chama).
function mockRegenerar(
  overrides: Partial<ReturnType<typeof useRegenerarCodigoTenant>> = {},
  { sucesso = true }: { sucesso?: boolean } = {},
) {
  const mutate = vi.fn((_vars: void, opts?: { onSuccess?: () => void }) => {
    if (sucesso) opts?.onSuccess?.();
  });
  const reset = vi.fn();
  mockedUseRegenerar.mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRegenerarCodigoTenant>);
  return { mutate, reset };
}

describe('ConviteAlunos', () => {
  beforeEach(() => {
    mockedUseTenantConfig.mockReset();
    mockedUseRegenerar.mockReset();
    mockRegenerar();
  });

  it('exibe carregamento enquanto a config carrega', () => {
    mockConfig({ isLoading: true });

    render(<ConviteAlunos />);

    expect(screen.getByText('Carregando convite...')).toBeInTheDocument();
  });

  it('exibe erro com botão de nova tentativa', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockConfig({ isError: true, refetch });

    render(<ConviteAlunos />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o convite.');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('avisa quando a API ainda não devolve o código', () => {
    mockConfig({ data: { ...configFixture, codigo: undefined } });

    render(<ConviteAlunos />);

    expect(screen.getByText(/código de convite ainda não está disponível/i)).toBeInTheDocument();
    expect(screen.queryByTestId('codigo-convite')).not.toBeInTheDocument();
  });

  it('mostra código, link de convite e QR', async () => {
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);

    expect(screen.getByTestId('codigo-convite')).toHaveTextContent(CODIGO);
    // O link usa a origem do navegador, lida depois do mount.
    expect(await screen.findByText(`${window.location.origin}/entrar/${CODIGO}`)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR code do link de convite' })).toBeInTheDocument();
    expect(screen.getByText(`amfit://entrar/${CODIGO}`)).toBeInTheDocument();
  });

  it('copia o código e o link', async () => {
    const user = userEvent.setup();
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);
    await screen.findByText(`${window.location.origin}/entrar/${CODIGO}`);

    await user.click(screen.getByRole('button', { name: 'Copiar código' }));
    expect(await navigator.clipboard.readText()).toBe(CODIGO);

    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/entrar/${CODIGO}`);
  });

  it('avisa qual endereço o link e o QR estão usando', async () => {
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);

    expect(
      await screen.findByText(new RegExp(`endereço que você está acessando agora \\(${window.location.origin}\\)`)),
    ).toBeInTheDocument();
  });

  it('pede confirmação antes de gerar um novo código e só então chama a API', async () => {
    const user = userEvent.setup();
    const { mutate } = mockRegenerar();
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);

    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/deixam de funcionar/i);
    expect(mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));

    expect(mutate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('cancelar a confirmação não chama a API e limpa o erro anterior', async () => {
    const user = userEvent.setup();
    const { mutate, reset } = mockRegenerar();
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);

    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));
    reset.mockClear();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('abrir a confirmação limpa o erro de uma tentativa anterior', async () => {
    const user = userEvent.setup();
    const { reset } = mockRegenerar();
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);
    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('numa falha o diálogo continua aberto, com o erro à vista', async () => {
    const user = userEvent.setup();
    mockRegenerar({ isError: true }, { sucesso: false });
    mockConfig({ data: configFixture });

    render(<ConviteAlunos />);
    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));
    await user.click(screen.getByRole('button', { name: 'Gerar novo código' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível gerar um novo código/i);
  });
});
