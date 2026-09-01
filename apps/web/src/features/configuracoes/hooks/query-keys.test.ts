import { describe, expect, it } from 'vitest';
import { personalKeys } from './query-keys';

describe('personalKeys', () => {
  it('produz uma key estavel para a conta do personal logado, sob o namespace "personal"', () => {
    expect(personalKeys.me()).toEqual(['personal', 'me']);
  });

  it('a key de "me" deriva do namespace raiz "all"', () => {
    expect(personalKeys.me()[0]).toBe(personalKeys.all[0]);
  });
});
