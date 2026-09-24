import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import {
  CACHE_MAX_AGE_MS,
  PERSISTED_QUERY_ROOTS,
  descartarTreinoHojeVencido,
  limparCache,
  limparCachePersistido,
  normalizarQueriesRestauradas,
  persistOptions,
  persister,
  shouldPersistQuery,
} from './query-persist';
import { queryClient as queryClientCompartilhado } from './query-client';

const STORAGE_KEY = 'amfit_rq_cache';

// Persister com throttle 0 só pros testes: o exportado (1 s) faria a segunda
// gravação de cada arquivo esperar o intervalo. Mesma chave e mesmo storage,
// então o que ele grava é o que `persister`/limparCachePersistido enxergam.
const persisterSemThrottle = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: STORAGE_KEY,
  throttleTime: 0,
});
const opcoes = { ...persistOptions, persister: persisterSemThrottle };

const treinoHoje = { treino: { id: 't1', letra: 'A' }, sessao_hoje_id: null };
const ficha = { id: 'f1', treinos: [{ id: 't1' }] };
const sessaoLocal = { id: 'local-1-abc', status: 'EM_ANDAMENTO', series: [{ numero_serie: 1 }] };

function clienteComDados() {
  const client = new QueryClient();
  client.setQueryData(['treino', 'hoje'], treinoHoje);
  client.setQueryData(['minha-ficha', 'ativa'], ficha);
  client.setQueryData(['sessoes', 'detail', 'local-1-abc'], sessaoLocal);
  // Fora da allowlist — dado pessoal, perecível ou sintético.
  client.setQueryData(['aluno', 'me'], { nome: 'Fulano', email: 'f@x.com' });
  client.setQueryData(['meu-financeiro', 'plano'], { valor: 100 });
  client.setQueryData(['meu-coach', 'videos', {}], { url: 'https://presigned' });
  client.setQueryData(['sessao-id-resolution', 'local-1-abc'], 'id-real');
  return client;
}

function buscar(client: QueryClient, queryKey: readonly unknown[]) {
  return client.getQueryCache().find({ queryKey });
}

describe('shouldPersistQuery', () => {
  it.each(['treino', 'minha-ficha', 'sessoes'])('aceita queries bem-sucedidas da raiz "%s"', (raiz: string) => {
    const client = new QueryClient();
    client.setQueryData([raiz, 'x'], { ok: true });

    expect(shouldPersistQuery(buscar(client, [raiz, 'x'])!)).toBe(true);
  });

  it.each(['aluno', 'meu-financeiro', 'meu-coach', 'meu-progresso', 'minhas-sessoes', 'exercicios', 'sessao-id-resolution'])(
    'rejeita a raiz "%s" (fora da allowlist)',
    (raiz: string) => {
      const client = new QueryClient();
      client.setQueryData([raiz, 'x'], { ok: true });

      expect(shouldPersistQuery(buscar(client, [raiz, 'x'])!)).toBe(false);
    },
  );

  it('rejeita uma query da allowlist que terminou em erro', async () => {
    const client = new QueryClient();
    await client
      .fetchQuery({
        queryKey: ['treino', 'hoje'],
        queryFn: () => Promise.reject(new Error('falhou')),
        retry: false,
      })
      .catch(() => undefined);

    expect(buscar(client, ['treino', 'hoje'])!.state.status).toBe('error');
    expect(shouldPersistQuery(buscar(client, ['treino', 'hoje'])!)).toBe(false);
  });

  it('aceita uma query da allowlist cujo refetch falhou mas que mantém o dado', async () => {
    const client = new QueryClient();
    client.setQueryData(['treino', 'hoje'], treinoHoje);
    await client
      .fetchQuery({
        queryKey: ['treino', 'hoje'],
        queryFn: () => Promise.reject(new Error('sem rede')),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);

    const query = buscar(client, ['treino', 'hoje'])!;
    expect(query.state.status).toBe('error');
    expect(query.state.data).toEqual(treinoHoje);
    expect(shouldPersistQuery(query)).toBe(true);
  });

  it('mantém a allowlist restrita ao fluxo de treino', () => {
    expect([...PERSISTED_QUERY_ROOTS].sort()).toEqual(['minha-ficha', 'sessoes', 'treino']);
  });
});

describe('ida e volta do cache pelo AsyncStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('restaura treino, ficha e sessão (inclusive ID local) num cliente novo', async () => {
    await persistQueryClientSave({ queryClient: clienteComDados(), ...opcoes });

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });

    expect(novo.getQueryData(['treino', 'hoje'])).toEqual(treinoHoje);
    expect(novo.getQueryData(['minha-ficha', 'ativa'])).toEqual(ficha);
    expect(novo.getQueryData(['sessoes', 'detail', 'local-1-abc'])).toEqual(sessaoLocal);
  });

  it('um refetch falho (offline) não tira a query do disco na gravação seguinte', async () => {
    const client = clienteComDados();
    await client
      .fetchQuery({
        queryKey: ['treino', 'hoje'],
        queryFn: () => Promise.reject(new Error('sem rede')),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    await persistQueryClientSave({ queryClient: client, ...opcoes });

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });

    expect(novo.getQueryData(['treino', 'hoje'])).toEqual(treinoHoje);
    expect(novo.getQueryData(['minha-ficha', 'ativa'])).toEqual(ficha);
  });

  it('não leva pro disco dado pessoal nem chaves sintéticas', async () => {
    await persistQueryClientSave({ queryClient: clienteComDados(), ...opcoes });

    const bruto = (await AsyncStorage.getItem(STORAGE_KEY)) ?? '';
    expect(bruto).not.toContain('Fulano');
    expect(bruto).not.toContain('f@x.com');
    expect(bruto).not.toContain('presigned');
    expect(bruto).not.toContain('id-real');

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });
    expect(novo.getQueryData(['aluno', 'me'])).toBeUndefined();
    expect(novo.getQueryData(['meu-financeiro', 'plano'])).toBeUndefined();
    expect(novo.getQueryData(['meu-coach', 'videos', {}])).toBeUndefined();
    expect(novo.getQueryData(['sessao-id-resolution', 'local-1-abc'])).toBeUndefined();
  });

  it('descarta (e apaga do disco) um cache mais velho que o maxAge', async () => {
    await persistQueryClientSave({ queryClient: clienteComDados(), ...opcoes });

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes, maxAge: -1 });

    expect(novo.getQueryData(['treino', 'hoje'])).toBeUndefined();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('descarta um cache gravado com outra versão de esquema (buster)', async () => {
    await persistQueryClientSave({
      queryClient: clienteComDados(),
      ...opcoes,
      buster: 'esquema-antigo',
    });

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });

    expect(novo.getQueryData(['treino', 'hoje'])).toBeUndefined();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('limparCachePersistido', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('apaga o cache persistido do disco', async () => {
    await persistQueryClientSave({ queryClient: clienteComDados(), ...opcoes });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await limparCachePersistido();

    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });
    expect(novo.getQueryData(['minha-ficha', 'ativa'])).toBeUndefined();
  });

  it('nunca lança: falha ao apagar não pode impedir o logout', async () => {
    const removeSpy = jest
      .spyOn(persister, 'removeClient')
      .mockRejectedValueOnce(new Error('disco cheio'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(limparCachePersistido()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('limparCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('esvazia o cache em memória e o do disco juntos', async () => {
    const client = clienteComDados();
    await persistQueryClientSave({ queryClient: client, ...opcoes });
    expect(client.getQueryData(['minha-ficha', 'ativa'])).toEqual(ficha);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await limparCache(client);

    expect(client.getQueryData(['minha-ficha', 'ativa'])).toBeUndefined();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('mutations nunca vão pro disco', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('não persiste uma mutation pausada com suas variáveis (ex.: senha de um login offline)', async () => {
    // O padrão do React Query grava toda mutation pausada COM as variáveis.
    // Uma mutation com networkMode 'online' (o padrão) fica pausada quando
    // offline — como o login feito sem conexão.
    await AsyncStorage.clear();
    onlineManager.setOnline(false);
    const client = new QueryClient();
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => 'ok',
    });
    void mutation.execute({ email: 'a@b.com', senha: 'senha-super-secreta' });
    await waitFor(() => expect(mutation.state.isPaused).toBe(true));

    await persistQueryClientSave({ queryClient: client, ...opcoes });

    const bruto = (await AsyncStorage.getItem(STORAGE_KEY)) ?? '';
    expect(bruto).not.toContain('senha-super-secreta');
    expect(JSON.parse(bruto).clientState.mutations).toEqual([]);
  });
});

describe('normalizarQueriesRestauradas', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('devolve pra success (sem erro) a query restaurada que foi gravada em erro com dado', async () => {
    const client = clienteComDados();
    await client
      .fetchQuery({
        queryKey: ['treino', 'hoje'],
        queryFn: () => Promise.reject(new Error('sem rede')),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    await persistQueryClientSave({ queryClient: client, ...opcoes });

    const novo = new QueryClient();
    await persistQueryClientRestore({ queryClient: novo, ...opcoes });
    normalizarQueriesRestauradas(novo);

    const state = novo.getQueryState(['treino', 'hoje'])!;
    expect(state.status).toBe('success');
    expect(state.error).toBeNull();
    expect(state.data).toEqual(treinoHoje);
  });

  it('não mexe numa query em erro sem dado', async () => {
    const client = new QueryClient();
    await client
      .fetchQuery({
        queryKey: ['treino', 'hoje'],
        queryFn: () => Promise.reject(new Error('sem rede')),
        retry: false,
      })
      .catch(() => undefined);

    normalizarQueriesRestauradas(client);

    expect(client.getQueryState(['treino', 'hoje'])!.status).toBe('error');
  });
});

describe('descartarTreinoHojeVencido', () => {
  const agora = new Date(2026, 8, 22, 10, 0, 0); // 22/09/2026 10:00 local

  function comTreinoHojeDe(atualizadoEm: Date) {
    const client = new QueryClient();
    client.setQueryData(['treino', 'hoje'], treinoHoje, { updatedAt: atualizadoEm.getTime() });
    client.setQueryData(['minha-ficha', 'ativa'], ficha, { updatedAt: atualizadoEm.getTime() });
    return client;
  }

  it('mantém o treino de hoje se foi atualizado hoje', () => {
    const client = comTreinoHojeDe(new Date(2026, 8, 22, 7, 30));

    descartarTreinoHojeVencido(client, agora);

    expect(client.getQueryData(['treino', 'hoje'])).toEqual(treinoHoje);
  });

  it('descarta o treino de hoje restaurado de ontem (senão mostraria o treino e o "Continuar" errados)', () => {
    const client = comTreinoHojeDe(new Date(2026, 8, 21, 22, 0));

    descartarTreinoHojeVencido(client, agora);

    expect(client.getQueryData(['treino', 'hoje'])).toBeUndefined();
  });

  it('não mexe na ficha, que vale por vários dias', () => {
    const client = comTreinoHojeDe(new Date(2026, 8, 18, 9, 0));

    descartarTreinoHojeVencido(client, agora);

    expect(client.getQueryData(['minha-ficha', 'ativa'])).toEqual(ficha);
  });

  it('não falha quando não há treino de hoje no cache', () => {
    const client = new QueryClient();

    expect(() => descartarTreinoHojeVencido(client, agora)).not.toThrow();
  });
});

describe('cliente compartilhado', () => {
  it.each(['treino', 'minha-ficha', 'sessoes'])(
    'mantém em memória por pelo menos o maxAge as queries persistidas da raiz "%s"',
    (raiz: string) => {
      // Regressão: com o gcTime padrão (5 min), queries inativas seriam
      // descartadas antes de chegarem ao disco e sumiriam na próxima gravação.
      const { gcTime } = queryClientCompartilhado.getQueryDefaults([raiz, 'qualquer']);

      expect(gcTime).toBeGreaterThanOrEqual(CACHE_MAX_AGE_MS);
    },
  );

  it.each(['aluno', 'meu-financeiro', 'exercicios'])(
    'mantém o gcTime padrão (curto) fora do cache persistido: raiz "%s"',
    (raiz: string) => {
      // Sem isso o cache de tudo que NÃO vai pro disco cresceria por uma semana.
      const { gcTime } = queryClientCompartilhado.getQueryDefaults([raiz, 'qualquer']);

      expect(gcTime).toBeUndefined();
    },
  );
});
