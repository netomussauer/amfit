import { apiRequest } from '@/shared/lib/api-client';
import { financeiroService } from './financeiro.service';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

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

describe('financeiroService.getMeuPlano', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o endpoint /alunos/me/plano', async () => {
    mockedApiRequest.mockResolvedValue(planoFixture);

    const result = await financeiroService.getMeuPlano();

    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/plano');
    expect(result).toEqual(planoFixture);
  });

  it('lança erro quando a resposta não corresponde ao schema esperado', async () => {
    mockedApiRequest.mockResolvedValue({ ...planoFixture, valor_mensal: 'nao-e-numero' });

    await expect(financeiroService.getMeuPlano()).rejects.toThrow();
  });
});

describe('financeiroService.getMinhasMensalidades', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o endpoint /alunos/me/mensalidades repassando os params', async () => {
    const response = { data: [mensalidadeFixture], pagination: { total: 1, page: 1, per_page: 12 } };
    mockedApiRequest.mockResolvedValue(response);

    const params = { per_page: 12 };
    const result = await financeiroService.getMinhasMensalidades(params);

    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/mensalidades', { params });
    expect(result).toEqual(response);
  });

  it('lança erro quando um item da lista não corresponde ao schema esperado', async () => {
    mockedApiRequest.mockResolvedValue({
      data: [{ ...mensalidadeFixture, status: 'INVALIDO' }],
      pagination: { total: 1, page: 1, per_page: 12 },
    });

    await expect(financeiroService.getMinhasMensalidades()).rejects.toThrow();
  });
});
