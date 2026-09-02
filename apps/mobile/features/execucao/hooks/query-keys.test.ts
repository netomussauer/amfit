import { sessaoKeys, minhasSessoesKeys } from './query-keys';

describe('sessaoKeys', () => {
  it('all é a chave raiz das sessões', () => {
    expect(sessaoKeys.all).toEqual(['sessoes']);
  });

  it('detail() inclui o id da sessão', () => {
    expect(sessaoKeys.detail('sessao-1')).toEqual(['sessoes', 'detail', 'sessao-1']);
  });

  it('detail() com ids diferentes produz chaves diferentes', () => {
    expect(sessaoKeys.detail('sessao-1')).not.toEqual(sessaoKeys.detail('sessao-2'));
  });
});

describe('minhasSessoesKeys', () => {
  it('all é a chave raiz de minhas sessões', () => {
    expect(minhasSessoesKeys.all).toEqual(['minhas-sessoes']);
  });

  it('list() inclui page e perPage', () => {
    expect(minhasSessoesKeys.list(1, 20)).toEqual([
      'minhas-sessoes',
      'list',
      { page: 1, perPage: 20 },
    ]);
  });

  it('list() com páginas diferentes produz chaves diferentes', () => {
    expect(minhasSessoesKeys.list(1, 20)).not.toEqual(minhasSessoesKeys.list(2, 20));
  });
});
