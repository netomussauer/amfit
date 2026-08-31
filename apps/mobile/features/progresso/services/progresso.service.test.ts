import { apiRequest } from '@/shared/lib/api-client';
import { progressoService } from './progresso.service';
import { makeHistoricoExercicioResponse } from '../__fixtures__/progresso.fixtures';

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
