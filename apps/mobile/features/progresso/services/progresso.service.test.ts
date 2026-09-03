import { apiRequest } from '@/shared/lib/api-client';
import { progressoService } from './progresso.service';
import {
  makeHistoricoExercicioResponse,
  makeSugestaoProgressaoResponse,
} from '../__fixtures__/progresso.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('progressoService.getMeuProgresso', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o histórico do exercício no endpoint /alunos/me/progresso/exercicio/:id', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const response = makeHistoricoExercicioResponse({ exercicio_id: exercicioId });
    mockedApiRequest.mockResolvedValue(response);

    // Act
    const result = await progressoService.getMeuProgresso(exercicioId);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith(
      `/alunos/me/progresso/exercicio/${exercicioId}`,
      { params: undefined },
    );
    expect(result).toEqual(response);
  });

  it('repassa os query params (from/to/limit) para apiRequest', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const params = { from: '2026-01-01', to: '2026-08-01', limit: 50 };
    mockedApiRequest.mockResolvedValue(makeHistoricoExercicioResponse());

    // Act
    await progressoService.getMeuProgresso(exercicioId, params);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith(
      `/alunos/me/progresso/exercicio/${exercicioId}`,
      { params },
    );
  });

  it('valida a resposta com o schema Zod e retorna os dados parseados', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const response = makeHistoricoExercicioResponse({
      exercicio_id: exercicioId,
      pontos: [
        {
          sessao_id: '44444444-4444-4444-4444-444444444444',
          data_execucao: '2026-07-15',
          numero_serie: 2,
          carga_realizada: 100,
          repeticoes_realizadas: 8,
        },
      ],
    });
    mockedApiRequest.mockResolvedValue(response);

    // Act
    const result = await progressoService.getMeuProgresso(exercicioId);

    // Assert
    expect(result.pontos).toHaveLength(1);
    expect(result.pontos[0]).toMatchObject({
      sessao_id: '44444444-4444-4444-4444-444444444444',
      carga_realizada: 100,
    });
  });

  it('lança erro quando a resposta da API não corresponde ao schema esperado', async () => {
    // Arrange — aluno_id inválido (não é um uuid) deve falhar na validação Zod
    mockedApiRequest.mockResolvedValue({
      aluno_id: 'nao-e-um-uuid',
      exercicio_id: '33333333-3333-3333-3333-333333333333',
      pontos: [],
    });

    // Act / Assert
    await expect(
      progressoService.getMeuProgresso('33333333-3333-3333-3333-333333333333'),
    ).rejects.toThrow();
  });
});

describe('progressoService.getMinhaSugestao', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca a sugestão no endpoint /alunos/me/progresso/exercicio/:id/sugestao', async () => {
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const response = makeSugestaoProgressaoResponse({ exercicio_id: exercicioId });
    mockedApiRequest.mockResolvedValue(response);

    const result = await progressoService.getMinhaSugestao(exercicioId);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      `/alunos/me/progresso/exercicio/${exercicioId}/sugestao`,
    );
    expect(result).toEqual(response);
  });

  it('valida e retorna quando tem_sugestao=false sem os campos opcionais', async () => {
    const response = makeSugestaoProgressaoResponse({
      tem_sugestao: false,
      direcao: undefined,
      carga_sugerida: undefined,
      ultima_carga_registrada: undefined,
      ultima_media_repeticoes: undefined,
    });
    mockedApiRequest.mockResolvedValue(response);

    const result = await progressoService.getMinhaSugestao('33333333-3333-3333-3333-333333333333');

    expect(result.tem_sugestao).toBe(false);
    expect(result.carga_sugerida).toBeUndefined();
  });

  it('lança erro quando a resposta não corresponde ao schema (exercicio_id inválido)', async () => {
    mockedApiRequest.mockResolvedValue({
      exercicio_id: 'nao-e-um-uuid',
      tem_sugestao: false,
    });

    await expect(
      progressoService.getMinhaSugestao('33333333-3333-3333-3333-333333333333'),
    ).rejects.toThrow();
  });

  it('lança erro quando direcao tem um valor fora do enum esperado', async () => {
    mockedApiRequest.mockResolvedValue({
      exercicio_id: '33333333-3333-3333-3333-333333333333',
      tem_sugestao: true,
      direcao: 'DIMINUIR',
      carga_sugerida: 10,
    });

    await expect(
      progressoService.getMinhaSugestao('33333333-3333-3333-3333-333333333333'),
    ).rejects.toThrow();
  });
});
