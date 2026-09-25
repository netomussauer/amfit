import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicTenantConfig } from '@/shared/lib/tenant';
import EntrarPage from './page';

vi.mock('@/shared/lib/tenant', () => ({
  getPublicTenantConfig: vi.fn(),
  tenantConfigToCssVars: (c: { cor_primaria: string; cor_secundaria: string } | null) =>
    c ? { '--color-primary': `#${c.cor_primaria}`, '--color-primary-hover': `#${c.cor_secundaria}` } : undefined,
}));
vi.mock('@/features/auth/components/LoginForm', () => ({
  LoginForm: () => <form aria-label="Login" />,
}));

const mockedGetPublic = vi.mocked(getPublicTenantConfig);

const CODIGO = 'K7M2QX9P';

const config = {
  logo_url: 'https://minio.amfit.local/tenant-logos/abc',
  cor_primaria: '112233',
  cor_secundaria: '445566',
  nome_app: 'Studio X',
};

async function renderPagina(codigo: string) {
  render(await EntrarPage({ params: { codigo } }));
}

describe('EntrarPage (/entrar/[codigo])', () => {
  beforeEach(() => {
    mockedGetPublic.mockReset();
  });

  it('mostra o login com logo, nome do app e cores do personal', async () => {
    mockedGetPublic.mockResolvedValueOnce(config);

    await renderPagina(CODIGO);

    expect(screen.getByRole('heading', { name: 'Studio X' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Logo Studio X' })).toHaveAttribute('src', config.logo_url);
    expect(screen.getByRole('form', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveStyle({ '--color-primary': '#112233' });
  });

  it('oferece abrir no app com o deep link do convite', async () => {
    mockedGetPublic.mockResolvedValueOnce(config);

    await renderPagina(CODIGO);

    expect(screen.getByRole('link', { name: 'Abrir no app' })).toHaveAttribute(
      'href',
      `amfit://entrar/${CODIGO}`,
    );
  });

  it('normaliza o código digitado em minúsculas/com espaços antes de buscar', async () => {
    mockedGetPublic.mockResolvedValueOnce(config);

    await renderPagina('k7m2 qx9p');

    expect(mockedGetPublic).toHaveBeenCalledWith(CODIGO);
  });

  it('cai em AMFIT quando o personal não definiu nome do app nem logo', async () => {
    mockedGetPublic.mockResolvedValueOnce({ cor_primaria: 'f97316', cor_secundaria: 'ea580c' });

    await renderPagina(CODIGO);

    expect(screen.getByRole('heading', { name: 'AMFIT' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('mostra "Convite não encontrado" com link para o login quando o código é inválido', async () => {
    mockedGetPublic.mockResolvedValueOnce(null);

    await renderPagina('ZZZZZZZZ');

    expect(screen.getByRole('heading', { name: 'Convite não encontrado' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('form', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('não quebra com sequência % malformada na URL', async () => {
    mockedGetPublic.mockResolvedValueOnce(null);

    await expect(renderPagina('%E0%A4%A')).resolves.not.toThrow();
    expect(screen.getByRole('heading', { name: 'Convite não encontrado' })).toBeInTheDocument();
  });
});
