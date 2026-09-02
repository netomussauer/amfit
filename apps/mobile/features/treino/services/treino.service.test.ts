import { apiRequest } from '@/shared/lib/api-client';
import { treinoService } from './treino.service';
import { makeFicha, makeTreinoHoje } from '../__fixtures__/treino.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('treinoService.getTreinoHoje', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o treino de hoje em /alunos/me/treino-hoje', async () => {
    // Arrange
    const response = makeTreinoHoje();
    mockedApiRequest.mockResolvedValue(response);

    // Act
    const result = await treinoService.getTreinoHoje();

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/treino-hoje');
    expect(result).toEqual(response);
  });

  it('retorna null quando a API responde 204 (sem ficha ativa ou treino hoje)', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue(undefined);

    // Act
    const result = await treinoService.getTreinoHoje();

    // Assert
    expect(result).toBeNull();
  });

  it('lança erro quando a resposta não corresponde ao schema esperado', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue({ treino: { id: 'nao-e-um-uuid' } });

    // Act / Assert
    await expect(treinoService.getTreinoHoje()).rejects.toThrow();
  });
});

describe('treinoService.getMinhaFicha', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca a ficha ativa em /alunos/me/ficha', async () => {
    // Arrange
    const response = makeFicha();
    mockedApiRequest.mockResolvedValue(response);

    // Act
    const result = await treinoService.getMinhaFicha();

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/ficha');
    expect(result).toEqual(response);
  });

  it('lança erro quando a resposta não corresponde ao schema esperado', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue({ id: 'nao-e-um-uuid' });

    // Act / Assert
    await expect(treinoService.getMinhaFicha()).rejects.toThrow();
  });
});
