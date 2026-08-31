import { progressoKeys } from './query-keys';

describe('progressoKeys', () => {
  it('all é a chave raiz da feature de progresso', () => {
    expect(progressoKeys.all).toEqual(['meu-progresso']);
  });

  it('exercicio() sem params usa um objeto vazio como parte estável da chave', () => {
    const key = progressoKeys.exercicio('exercicio-1');
    expect(key).toEqual(['meu-progresso', 'exercicio-1', {}]);
  });

  it('exercicio() com params inclui os params na chave', () => {
    const params = { from: '2026-01-01', limit: 10 };
    const key = progressoKeys.exercicio('exercicio-1', params);
    expect(key).toEqual(['meu-progresso', 'exercicio-1', params]);
  });

  it('exercicio() com ids diferentes produz chaves diferentes', () => {
    const key1 = progressoKeys.exercicio('exercicio-1');
    const key2 = progressoKeys.exercicio('exercicio-2');
    expect(key1).not.toEqual(key2);
  });
});
