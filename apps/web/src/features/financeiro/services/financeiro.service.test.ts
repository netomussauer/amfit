import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financeiroService } from './financeiro.service';

const { mockedGet, mockedPost, mockedPatch } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
  mockedPatch: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost, patch: mockedPatch },
}));

const planoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  aluno_id: '22222222-2222-2222-2222-222222222222',
  valor_mensal: 200,
  dia_vencimento: 10,
  vigencia_inicio: '2026-01-01',
  status: 'ATIVO' as const,
  criado_em: '2026-01-01T10:00:00Z',
  atualizado_em: '2026-01-01T10:00:00Z',
};

const mensalidadeFixture = {
  id: '33333333-3333-3333-3333-333333333333',
  plano_id: planoFixture.id,
  aluno_id: planoFixture.aluno_id,
  competencia_ano: 2026,
  competencia_mes: 9,
  data_vencimento: '2026-09-10',
  valor: 200,
  status: 'PENDENTE' as const,
  criado_em: '2026-09-01T10:00:00Z',
  atualizado_em: '2026-09-01T10:00:00Z',
};

const dashboardFixture = {
  mensalidades_pendentes: { qtd: 2, valor: 400 },
  mensalidades_atrasadas: { qtd: 1, valor: 200 },
  receita_mes_atual: 600,
  inadimplentes: [],
};

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedPatch.mockReset();
});

describe('financeiroService.getPlano', () => {
  it('busca /alunos/:id/plano', async () => {
    mockedGet.mockResolvedValueOnce({ data: planoFixture });

    const resultado = await financeiroService.getPlano(planoFixture.aluno_id);

    expect(mockedGet).toHaveBeenCalledWith(`/alunos/${planoFixture.aluno_id}/plano`);
    expect(resultado).toEqual(planoFixture);
  });
});

describe('financeiroService.configurarPlano', () => {
  it('envia POST removendo campos vazios/undefined do payload', async () => {
    mockedPost.mockResolvedValueOnce({ data: planoFixture });

    await financeiroService.configurarPlano(planoFixture.aluno_id, {
      valor_mensal: 200,
      dia_vencimento: 10,
      vigencia_inicio: '',
      observacao: undefined,
    });

    expect(mockedPost).toHaveBeenCalledWith(`/alunos/${planoFixture.aluno_id}/plano`, {
      valor_mensal: 200,
      dia_vencimento: 10,
    });
  });
});

describe('financeiroService.atualizarPlano', () => {
  it('envia PATCH /planos/:id com o payload informado', async () => {
    mockedPatch.mockResolvedValueOnce({ data: planoFixture });

    await financeiroService.atualizarPlano(planoFixture.id, { status: 'SUSPENSO' });

    expect(mockedPatch).toHaveBeenCalledWith(`/planos/${planoFixture.id}`, {
      status: 'SUSPENSO',
    });
  });
});

describe('financeiroService.listMensalidades', () => {
  it('busca /mensalidades com page/per_page, omitindo filtros nao informados', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [mensalidadeFixture], pagination: { total: 1, page: 1, per_page: 20 } },
    });

    await financeiroService.listMensalidades({ page: 1, perPage: 20 });

    expect(mockedGet).toHaveBeenCalledWith('/mensalidades', {
      params: { page: 1, per_page: 20 },
    });
  });

  it('inclui os filtros quando informados', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });

    await financeiroService.listMensalidades({
      page: 1,
      perPage: 20,
      alunoId: planoFixture.aluno_id,
      status: 'ATRASADA',
      competenciaAno: 2026,
      competenciaMes: 9,
    });

    expect(mockedGet).toHaveBeenCalledWith('/mensalidades', {
      params: {
        page: 1,
        per_page: 20,
        aluno_id: planoFixture.aluno_id,
        status: 'ATRASADA',
        competencia_ano: 2026,
        competencia_mes: 9,
      },
    });
  });
});

describe('financeiroService.marcarPaga', () => {
  it('envia PATCH /mensalidades/:id/marcar-paga removendo campos vazios', async () => {
    mockedPatch.mockResolvedValueOnce({ data: { ...mensalidadeFixture, status: 'PAGA' } });

    await financeiroService.marcarPaga(mensalidadeFixture.id, {
      forma_pagamento: 'PIX',
      data_pagamento: '',
      observacao: undefined,
    });

    expect(mockedPatch).toHaveBeenCalledWith(
      `/mensalidades/${mensalidadeFixture.id}/marcar-paga`,
      { forma_pagamento: 'PIX' },
    );
  });
});

describe('financeiroService.atualizarStatusMensalidade', () => {
  it('envia PATCH /mensalidades/:id', async () => {
    mockedPatch.mockResolvedValueOnce({ data: { ...mensalidadeFixture, status: 'CANCELADA' } });

    await financeiroService.atualizarStatusMensalidade(mensalidadeFixture.id, {
      status: 'CANCELADA',
    });

    expect(mockedPatch).toHaveBeenCalledWith(`/mensalidades/${mensalidadeFixture.id}`, {
      status: 'CANCELADA',
    });
  });
});

describe('financeiroService.getDashboard', () => {
  it('busca /financeiro/dashboard', async () => {
    mockedGet.mockResolvedValueOnce({ data: dashboardFixture });

    const resultado = await financeiroService.getDashboard();

    expect(mockedGet).toHaveBeenCalledWith('/financeiro/dashboard');
    expect(resultado).toEqual(dashboardFixture);
  });

  it('lanca erro de validacao quando a resposta nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...dashboardFixture, receita_mes_atual: 'x' } });

    await expect(financeiroService.getDashboard()).rejects.toThrow();
  });
});
