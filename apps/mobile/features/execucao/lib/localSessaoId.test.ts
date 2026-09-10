import { SESSAO_STATUS } from '@amfit/shared';
import {
  generateLocalSessaoId,
  isLocalSessaoId,
  buildPlaceholderSessao,
} from './localSessaoId';

describe('generateLocalSessaoId', () => {
  it('gera IDs no formato local-<timestamp>-<random>', () => {
    const id = generateLocalSessaoId();

    expect(id).toMatch(/^local-\d+-[a-z0-9]+$/);
  });

  it('gera IDs diferentes a cada chamada', () => {
    const id1 = generateLocalSessaoId();
    const id2 = generateLocalSessaoId();

    expect(id1).not.toBe(id2);
  });
});

describe('isLocalSessaoId', () => {
  it('reconhece um ID local', () => {
    expect(isLocalSessaoId('local-1234567890-abc123')).toBe(true);
  });

  it('não reconhece um UUID real como ID local', () => {
    expect(isLocalSessaoId('50000000-0000-0000-0000-000000000001')).toBe(false);
  });
});

describe('buildPlaceholderSessao', () => {
  it('monta uma sessão sintética EM_ANDAMENTO sem séries', () => {
    const localId = 'local-1234567890-abc123';
    const treinoId = '60000000-0000-0000-0000-000000000001';

    const sessao = buildPlaceholderSessao(localId, treinoId);

    expect(sessao).toMatchObject({
      id: localId,
      treino_id: treinoId,
      status: SESSAO_STATUS.EM_ANDAMENTO,
      concluido_em: null,
      series: [],
    });
    expect(sessao.data_execucao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sessao.iniciado_em).toEqual(expect.any(String));
  });
});
