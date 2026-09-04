import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MensalidadeListResponse } from '@amfit/shared';
import { polyfillDialogElement } from '@/features/fichas/test-utils/polyfill-dialog';
import { useMensalidades } from '../hooks/useMensalidades';
import { useAtualizarStatusMensalidade } from '../hooks/useAtualizarStatusMensalidade';
import { MensalidadesTable } from './MensalidadesTable';

polyfillDialogElement();

vi.mock('../hooks/useMensalidades');
vi.mock('../hooks/useAtualizarStatusMensalidade');
vi.mock('../hooks/useMarcarPaga', () => ({
  useMarcarPaga: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockedUseMensalidades = vi.mocked(useMensalidades);
const mockedUseAtualizarStatusMensalidade = vi.mocked(useAtualizarStatusMensalidade);

function mockUseMensalidadesReturn(overrides: Partial<ReturnType<typeof useMensalidades>>) {
  mockedUseMensalidades.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMensalidades>);
}

const mensalidadePendente = {
  id: 'mensalidade-1',
  plano_id: 'plano-1',
  aluno_id: 'aluno-1',
  competencia_ano: 2026,
  competencia_mes: 9,
  data_vencimento: '2026-09-10',
  valor: 200,
  status: 'PENDENTE' as const,
  criado_em: '2026-09-01T10:00:00Z',
  atualizado_em: '2026-09-01T10:00:00Z',
};

const mensalidadePaga = {
  ...mensalidadePendente,
  id: 'mensalidade-2',
  status: 'PAGA' as const,
  valor_pago: 200,
};

const listFixture: MensalidadeListResponse = {
  data: [mensalidadePendente, mensalidadePaga],
  pagination: { total: 2, page: 1, per_page: 20 },
};

describe('MensalidadesTable', () => {
  beforeEach(() => {
    mockedUseMensalidades.mockReset();
    mockedUseAtualizarStatusMensalidade.mockReset();
    mockedUseAtualizarStatusMensalidade.mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useAtualizarStatusMensalidade>);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('exibe estado de carregamento', () => {
    mockUseMensalidadesReturn({ isLoading: true });
    render(<MensalidadesTable />);
    expect(screen.getByText(/carregando mensalidades/i)).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseMensalidadesReturn({ isError: true, refetch });

    render(<MensalidadesTable />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio quando nao ha mensalidades', () => {
    mockUseMensalidadesReturn({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });
    render(<MensalidadesTable />);
    expect(screen.getByText(/nenhuma mensalidade encontrada/i)).toBeInTheDocument();
  });

  it('mostra as acoes marcar paga/cancelar apenas para PENDENTE/ATRASADA', () => {
    mockUseMensalidadesReturn({ data: listFixture });
    render(<MensalidadesTable />);

    const rows = screen.getAllByRole('row').slice(1); // pula o cabecalho
    expect(rows[0]).toHaveTextContent('Marcar paga');
    expect(rows[1]).not.toHaveTextContent('Marcar paga');
  });

  it('abre o modal de marcar paga ao clicar na acao', async () => {
    const user = userEvent.setup();
    mockUseMensalidadesReturn({ data: listFixture });
    render(<MensalidadesTable />);

    await user.click(screen.getAllByRole('button', { name: /marcar paga/i })[0]);
    expect(screen.getByRole('dialog', { name: /marcar mensalidade como paga/i })).toBeInTheDocument();
  });

  it('cancela a mensalidade apos confirmacao', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockedUseAtualizarStatusMensalidade.mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useAtualizarStatusMensalidade>);
    mockUseMensalidadesReturn({ data: listFixture });

    render(<MensalidadesTable />);
    await user.click(screen.getAllByRole('button', { name: /cancelar/i })[0]);

    expect(mutate).toHaveBeenCalledWith({
      mensalidadeId: 'mensalidade-1',
      payload: { status: 'CANCELADA' },
    });
  });

  it('nao cancela quando o usuario nao confirma', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mutate = vi.fn();
    mockedUseAtualizarStatusMensalidade.mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useAtualizarStatusMensalidade>);
    mockUseMensalidadesReturn({ data: listFixture });

    render(<MensalidadesTable />);
    await user.click(screen.getAllByRole('button', { name: /cancelar/i })[0]);

    expect(mutate).not.toHaveBeenCalled();
  });

  it('reinicia a pagina ao trocar o filtro de status', async () => {
    const user = userEvent.setup();
    mockUseMensalidadesReturn({ data: listFixture });
    render(<MensalidadesTable />);

    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), 'ATRASADA');

    expect(mockedUseMensalidades).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ATRASADA', page: 1 }),
    );
  });
});
