import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrarAnamneseRequest } from '@amfit/shared';
import { anamneseService } from './anamnese.service';

const { mockedGet, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost },
}));

const alunoId = '11111111-1111-1111-1111-111111111111';

const respostaFixture = { opcao: '3-4 dias/semana', pontos: 20 };

const anamneseFixture = {
  id: '22222222-2222-2222-2222-222222222222',
  aluno_id: alunoId,
  objetivo: 'Ganhar massa magra',
  pratica_outro_esporte: false,
  respostas: {
    frequencia_semanal: respostaFixture,
    experiencia_meses: { opcao: '6 meses a 2 anos', pontos: 15 },
    objetivo: { opcao: 'Hipertrofia', pontos: 10 },
    restricoes: { opcao: 'Não', pontos: 0 },
    disponibilidade: { opcao: '3 dias', pontos: 5 },
  },
  score_calculado: 50,
  nivel_sugerido: 'INTERMEDIARIO' as const,
  preenchido_em: '2026-05-11T16:46:15Z',
  atualizado_em: '2026-05-11T16:46:15Z',
};

const registrarPayload: RegistrarAnamneseRequest = {
  objetivo: 'Ganhar massa magra',
  pratica_outro_esporte: false,
  respostas: {
    frequencia_semanal: '3_4_dias',
    experiencia_meses: '6_meses_2_anos',
    objetivo: 'hipertrofia',
    restricoes: 'nao',
    disponibilidade: '3_dias',
  },
};

describe('anamneseService.getByAluno', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/:id/anamnese e retorna os dados quando a resposta é válida', async () => {
    mockedGet.mockResolvedValueOnce({ data: anamneseFixture });

    const resultado = await anamneseService.getByAluno(alunoId);

    expect(mockedGet).toHaveBeenCalledWith(`/alunos/${alunoId}/anamnese`);
    expect(resultado).toEqual(anamneseFixture);
  });

  it('não vem com template_ficha_id/nome no GET (esperado, não é bug)', async () => {
    mockedGet.mockResolvedValueOnce({ data: anamneseFixture });

    const resultado = await anamneseService.getByAluno(alunoId);

    expect(resultado.template_ficha_id).toBeUndefined();
    expect(resultado.template_ficha_nome).toBeUndefined();
  });

  it('lança erro de validação quando a resposta da API não bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { ...anamneseFixture, nivel_sugerido: 'MUITO_AVANCADO' },
    });

    await expect(anamneseService.getByAluno(alunoId)).rejects.toThrow();
  });
});

describe('anamneseService.registrar', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('envia POST /alunos/:id/anamnese removendo campos vazios/undefined do payload', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        ...anamneseFixture,
        template_ficha_id: '33333333-3333-3333-3333-333333333333',
        template_ficha_nome: 'Hipertrofia AB Intermediário',
      },
    });

    const resultado = await anamneseService.registrar(alunoId, {
      ...registrarPayload,
      lesoes: '',
      outro_esporte: undefined,
    });

    expect(mockedPost).toHaveBeenCalledWith(`/alunos/${alunoId}/anamnese`, registrarPayload);
    expect(resultado.template_ficha_id).toBe('33333333-3333-3333-3333-333333333333');
    expect(resultado.template_ficha_nome).toBe('Hipertrofia AB Intermediário');
  });

  it('mantém frequencia_semanas_anterior igual a 0 (não trata como ausente)', async () => {
    mockedPost.mockResolvedValueOnce({ data: anamneseFixture });

    await anamneseService.registrar(alunoId, {
      ...registrarPayload,
      frequencia_semanas_anterior: 0,
    });

    expect(mockedPost).toHaveBeenCalledWith(`/alunos/${alunoId}/anamnese`, {
      ...registrarPayload,
      frequencia_semanas_anterior: 0,
    });
  });

  it('lança erro de validação quando o payload não bate com o schema antes de enviar', async () => {
    await expect(
      anamneseService.registrar(alunoId, {
        ...registrarPayload,
        objetivo: 'x',
      }),
    ).rejects.toThrow();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
