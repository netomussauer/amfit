import { exercicioKeys, grupoMuscularKeys } from './query-keys';

describe('exercicioKeys', () => {
  it('all é a chave raiz da feature de exercícios', () => {
    expect(exercicioKeys.all).toEqual(['exercicios']);
  });

  it('lists() estende a chave raiz com "list"', () => {
    expect(exercicioKeys.lists()).toEqual(['exercicios', 'list']);
  });

  it('list(params) inclui os params de filtro na chave', () => {
    const params = { grupo_muscular_id: 'grupo-1', busca: 'supino' };
    expect(exercicioKeys.list(params)).toEqual(['exercicios', 'list', params]);
  });

  it('details() estende a chave raiz com "detail"', () => {
    expect(exercicioKeys.details()).toEqual(['exercicios', 'detail']);
  });

  it('detail(id) inclui o id do exercício na chave', () => {
    expect(exercicioKeys.detail('exercicio-1')).toEqual([
      'exercicios',
      'detail',
      'exercicio-1',
    ]);
  });

  it('detail() com ids diferentes produz chaves diferentes', () => {
    expect(exercicioKeys.detail('exercicio-1')).not.toEqual(
      exercicioKeys.detail('exercicio-2'),
    );
  });
});

describe('grupoMuscularKeys', () => {
  it('all é a chave raiz da feature de grupos musculares', () => {
    expect(grupoMuscularKeys.all).toEqual(['grupos-musculares']);
  });

  it('list() estende a chave raiz com "list"', () => {
    expect(grupoMuscularKeys.list()).toEqual(['grupos-musculares', 'list']);
  });
});
