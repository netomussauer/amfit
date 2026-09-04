import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfigResponse } from '@amfit/shared';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { useAtualizarTenantConfig } from '../hooks/useAtualizarTenantConfig';
import { BrandingForm } from './BrandingForm';

vi.mock('../hooks/useTenantConfig');
vi.mock('../hooks/useAtualizarTenantConfig');

const mockedUseTenantConfig = vi.mocked(useTenantConfig);
const mockedUseAtualizarTenantConfig = vi.mocked(useAtualizarTenantConfig);

// jsdom não implementa URL.createObjectURL/revokeObjectURL (usados pelo
// preview do logo escolhido) — mesmo mock de ExercicioForm.test.tsx.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
  URL.revokeObjectURL = vi.fn();
});

const configFixture: TenantConfigResponse = {
  logo_url: 'https://minio.amfit.local/tenant-logos/abc.png',
  cor_primaria: 'f97316',
  cor_secundaria: 'ea580c',
  nome_app: 'Studio X',
};

function mockUseTenantConfigReturn(overrides: Partial<ReturnType<typeof useTenantConfig>>) {
  mockedUseTenantConfig.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useTenantConfig>);
}

function mockUseAtualizarTenantConfigReturn(
  overrides: Partial<ReturnType<typeof useAtualizarTenantConfig>>,
) {
  mockedUseAtualizarTenantConfig.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarTenantConfig>);
}

describe('BrandingForm', () => {
  beforeEach(() => {
    mockedUseTenantConfig.mockReset();
    mockedUseAtualizarTenantConfig.mockReset();
    mockUseAtualizarTenantConfigReturn({});
  });

  it('exibe mensagem de carregamento enquanto isLoading é true', () => {
    mockUseTenantConfigReturn({ isLoading: true });

    render(<BrandingForm />);

    expect(screen.getByText(/carregando configuração de marca/i)).toBeInTheDocument();
  });

  it('exibe erro com botão de retry quando isError é true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseTenantConfigReturn({ isError: true, refetch });

    render(<BrandingForm />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a configuração de marca.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('preenche o formulário com a config carregada, incluindo preview do logo existente', () => {
    mockUseTenantConfigReturn({ data: configFixture });

    render(<BrandingForm />);

    expect(screen.getByLabelText(/cor primária/i)).toHaveValue('f97316');
    expect(screen.getByLabelText(/cor secundária/i)).toHaveValue('ea580c');
    expect(screen.getByLabelText(/nome do app/i)).toHaveValue('Studio X');
    expect(screen.getByAltText(/preview do logo/i)).toHaveAttribute(
      'src',
      configFixture.logo_url,
    );
  });

  it('exibe "Sem logo" quando não há logo customizado ainda', () => {
    mockUseTenantConfigReturn({ data: { cor_primaria: 'f97316', cor_secundaria: 'ea580c' } });

    render(<BrandingForm />);

    expect(screen.getByText('Sem logo')).toBeInTheDocument();
  });

  it('rejeita um logo de tipo não suportado sem chamar a mutation', () => {
    mockUseTenantConfigReturn({ data: configFixture });
    const mutate = vi.fn();
    mockUseAtualizarTenantConfigReturn({ mutate });

    render(<BrandingForm />);

    // `accept="image/jpeg,image/png"` já filtra isso no seletor nativo de
    // arquivo, então `userEvent.upload` (que respeita `accept`) não
    // consegue simular esse caso — usa fireEvent.change direto pra
    // exercitar a validação em JS (defesa extra: `accept` não impede
    // drag-and-drop de um arquivo de outro tipo).
    const arquivo = new File(['fake'], 'logo.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/escolher arquivo/i);
    fireEvent.change(input, { target: { files: [arquivo] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/formato não suportado/i);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('salva as alterações e exibe mensagem de sucesso', async () => {
    const user = userEvent.setup();
    mockUseTenantConfigReturn({ data: configFixture });
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess(configFixture);
    });
    mockUseAtualizarTenantConfigReturn({ mutate });

    render(<BrandingForm />);

    await user.clear(screen.getByLabelText(/nome do app/i));
    await user.type(screen.getByLabelText(/nome do app/i), 'Novo Nome');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.payload.nome_app).toBe('Novo Nome');
    expect(vars.logo).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Marca atualizada com sucesso.');
  });

  it('inclui o arquivo de logo escolhido na chamada da mutation', async () => {
    const user = userEvent.setup();
    mockUseTenantConfigReturn({ data: configFixture });
    const mutate = vi.fn();
    mockUseAtualizarTenantConfigReturn({ mutate });

    render(<BrandingForm />);

    const arquivo = new File(['fake'], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/escolher arquivo/i), arquivo);
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.logo).toBe(arquivo);
  });

  it('rejeita cor em formato inválido via validação do schema', async () => {
    const user = userEvent.setup();
    mockUseTenantConfigReturn({ data: configFixture });
    const mutate = vi.fn();
    mockUseAtualizarTenantConfigReturn({ mutate });

    render(<BrandingForm />);

    await user.clear(screen.getByLabelText(/cor primária/i));
    await user.type(screen.getByLabelText(/cor primária/i), 'zzzzzz');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/hexadecimal de 6 dígitos/i),
    ).toBeInTheDocument();
  });
});
