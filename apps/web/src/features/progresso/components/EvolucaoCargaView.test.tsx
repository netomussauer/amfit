import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EvolucaoCargaPoint } from '../lib/chart-data';
import { EvolucaoCargaView } from './EvolucaoCargaView';

// Isola o teste da renderizacao real do recharts — coberto separadamente em
// EvolucaoCargaChart.test.tsx.
vi.mock('./EvolucaoCargaChart', () => ({
  EvolucaoCargaChart: () => <div data-testid="evolucao-chart-mock" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const pontoFixture: EvolucaoCargaPoint = {
  sessaoId: 'sessao-1',
  data: '2026-01-10',
  cargaMaxima: 45,
  volumeTotal: 850,
  totalSeries: 2,
};

function baseProps(overrides: Partial<React.ComponentProps<typeof EvolucaoCargaView>> = {}) {
  return {
    breadcrumb: [{ href: '/historico', label: 'Histórico' }],
    titulo: 'Supino reto',
    subtitulo: 'Sua progressão de carga neste exercício.',
    range: '90' as const,
    onRangeChange: vi.fn(),
    isLoading: false,
    isError: false,
    mensagemErro: 'Não foi possível carregar.',
    onRetry: vi.fn(),
    evolucao: [pontoFixture],
    ...overrides,
  };
}

describe('EvolucaoCargaView', () => {
  it('renderiza um unico item de breadcrumb (visao do aluno)', () => {
    render(<EvolucaoCargaView {...baseProps()} />);

    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute(
      'href',
      '/historico',
    );
    expect(screen.getByRole('heading', { name: 'Supino reto' })).toBeInTheDocument();
  });

  it('renderiza multiplos itens de breadcrumb em ordem (visao do personal)', () => {
    render(
      <EvolucaoCargaView
        {...baseProps({
          breadcrumb: [
            { href: '/alunos', label: 'Alunos' },
            { href: '/alunos/aluno-1', label: 'Maria Silva' },
          ],
        })}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Alunos', 'Maria Silva']);
    expect(links[1]).toHaveAttribute('href', '/alunos/aluno-1');
  });

  it('chama onRetry ao clicar em "Tentar novamente" no estado de erro', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<EvolucaoCargaView {...baseProps({ isError: true, onRetry })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar.');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('chama onRangeChange com o valor do periodo clicado', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(<EvolucaoCargaView {...baseProps({ onRangeChange })} />);

    await user.click(screen.getByRole('radio', { name: 'Últimos 30 dias' }));

    expect(onRangeChange).toHaveBeenCalledWith('30');
  });

  it('renderiza a tabela agregada a partir de evolucao', () => {
    render(<EvolucaoCargaView {...baseProps()} />);

    const table = screen.getByRole('table', { name: 'Evolução de carga por sessão' });
    expect(within(table).getByText('45 kg')).toBeInTheDocument();
  });
});
