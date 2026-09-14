import { pluralizar } from './pluralize';

describe('pluralizar', () => {
  it('devolve a forma singular quando count é 1', () => {
    expect(pluralizar(1, 'ação', 'ações')).toBe('ação');
  });

  it('devolve a forma plural quando count é 0', () => {
    expect(pluralizar(0, 'ação', 'ações')).toBe('ações');
  });

  it('devolve a forma plural quando count é maior que 1', () => {
    expect(pluralizar(3, 'ação', 'ações')).toBe('ações');
  });
});
