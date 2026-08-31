import { describe, expect, it } from 'vitest';
import { progressoKeys } from './query-keys';

describe('progressoKeys', () => {
  it('produz uma key estavel para o dashboard, sob o namespace "progresso"', () => {
    expect(progressoKeys.dashboard()).toEqual(['progresso', 'dashboard']);
  });

  it('produz keys de historico diferentes para params diferentes (evita colisao de cache)', () => {
    const paramsA = { alunoId: 'aluno-1', exercicioId: 'exercicio-1' };
    const paramsB = { alunoId: 'aluno-2', exercicioId: 'exercicio-1' };

    expect(progressoKeys.historico(paramsA)).not.toEqual(progressoKeys.historico(paramsB));
  });

  it('inclui o objeto de params inteiro na key de historico (from/to/limit tambem versionam o cache)', () => {
    const params = { alunoId: 'aluno-1', exercicioId: 'exercicio-1', from: '2026-01-01' };

    expect(progressoKeys.historico(params)).toEqual(['progresso', 'historico', params]);
  });

  it('todas as keys derivam do namespace raiz "all"', () => {
    expect(progressoKeys.dashboard()[0]).toBe(progressoKeys.all[0]);
    expect(progressoKeys.historico({ alunoId: 'a', exercicioId: 'e' })[0]).toBe(
      progressoKeys.all[0],
    );
  });
});
