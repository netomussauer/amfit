import { mergeSerieIntoSessao } from './mergeSerieIntoSessao';
import { makeRegistroSerieResponse, makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

describe('mergeSerieIntoSessao', () => {
  it('substitui a série existente quando a chave (item_treino_id, numero_serie) já existe', () => {
    const existente = makeRegistroSerieResponse({ id: 'antigo', concluida: false });
    const sessao = makeSessaoResponse({ series: [existente] });
    const novo = makeRegistroSerieResponse({ id: 'novo', concluida: true });

    const resultado = mergeSerieIntoSessao(sessao, novo);

    expect(resultado.series).toEqual([novo]);
  });

  it('adiciona a série quando a chave não existe ainda', () => {
    const sessao = makeSessaoResponse({ series: [] });
    const novo = makeRegistroSerieResponse({ numero_serie: 1 });

    const resultado = mergeSerieIntoSessao(sessao, novo);

    expect(resultado.series).toEqual([novo]);
  });

  it('não modifica o objeto sessão original (imutável)', () => {
    const sessao = makeSessaoResponse({ series: [] });
    const novo = makeRegistroSerieResponse();

    mergeSerieIntoSessao(sessao, novo);

    expect(sessao.series).toEqual([]);
  });
});
