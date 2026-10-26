import type {
  ItemTreinoResponse,
  RegistroSerieResponse,
  SessaoResponse,
  TreinoResponse,
} from '@amfit/shared';

export function makeItem(overrides: Partial<ItemTreinoResponse> = {}): ItemTreinoResponse {
  return {
    id: '30000000-0000-0000-0000-000000000001',
    ordem: 0,
    exercicio: {
      id: '10000000-0000-0000-0000-000000000001',
      nome: 'Supino Reto',
      descricao: null,
      grupo_muscular: { id: '20000000-0000-0000-0000-000000000001', nome: 'Peito' },
      midia_url: null,
      tipo_midia: null,
      is_global: true,
    },
    series: 3,
    repeticoes: '10',
    carga_sugerida: 40,
    descanso_segundos: 60,
    observacao: null,
    ...overrides,
  };
}

export function makeTreino(overrides: Partial<TreinoResponse> = {}): TreinoResponse {
  return {
    id: '40000000-0000-0000-0000-000000000001',
    letra: 'A',
    nome: 'Peito e tríceps',
    ordem: 0,
    itens: [makeItem()],
    ...overrides,
  };
}

export function makeSerie(
  overrides: Partial<RegistroSerieResponse> = {},
): RegistroSerieResponse {
  return {
    id: '50000000-0000-0000-0000-000000000001',
    item_treino_id: '30000000-0000-0000-0000-000000000001',
    numero_serie: 1,
    concluida: true,
    carga_realizada: null,
    repeticoes_realizadas: null,
    ...overrides,
  } as RegistroSerieResponse;
}

export function makeSessao(overrides: Partial<SessaoResponse> = {}): SessaoResponse {
  return {
    id: '60000000-0000-0000-0000-000000000001',
    treino_id: '40000000-0000-0000-0000-000000000001',
    data_execucao: '2026-10-26',
    status: 'EM_ANDAMENTO',
    iniciado_em: '2026-10-26T10:00:00.000Z',
    concluido_em: null,
    series: [],
    treino: makeTreino(),
    ...overrides,
  } as SessaoResponse;
}
