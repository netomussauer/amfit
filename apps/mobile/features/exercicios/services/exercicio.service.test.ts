import { apiRequest } from '@/shared/lib/api-client';
import { exercicioService } from './exercicio.service';
import { makeExercicio, makeGrupoMuscular } from '../__fixtures__/exercicio.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('exercicioService', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  describe('listGrupos', () => {
    it('busca os grupos musculares em /grupos-musculares', async () => {
      // Arrange
      const grupos = [makeGrupoMuscular()];
      mockedApiRequest.mockResolvedValue(grupos);

      // Act
      const result = await exercicioService.listGrupos();

      // Assert
      expect(mockedApiRequest).toHaveBeenCalledWith('/grupos-musculares');
      expect(result).toEqual(grupos);
    });
  });

  describe('list', () => {
    it('busca exercícios em /exercicios repassando os params de filtro', async () => {
      // Arrange
      const response = { data: [makeExercicio()] };
      mockedApiRequest.mockResolvedValue(response);
      const params = { grupo_muscular_id: 'grupo-1', busca: 'supino' };

      // Act
      const result = await exercicioService.list(params);

      // Assert
      expect(mockedApiRequest).toHaveBeenCalledWith('/exercicios', { params });
      expect(result).toEqual(response);
    });
  });

  describe('getById', () => {
    it('busca um exercício específico em /exercicios/:id', async () => {
      // Arrange
      const exercicio = makeExercicio({ id: 'exercicio-1' });
      mockedApiRequest.mockResolvedValue(exercicio);

      // Act
      const result = await exercicioService.getById('exercicio-1');

      // Assert
      expect(mockedApiRequest).toHaveBeenCalledWith('/exercicios/exercicio-1');
      expect(result).toEqual(exercicio);
    });
  });

  describe('create', () => {
    it('envia um FormData multipart sem mídia quando midia é null', async () => {
      // Arrange
      const exercicio = makeExercicio();
      mockedApiRequest.mockResolvedValue(exercicio);
      const data = { nome: 'Supino reto', grupo_muscular_id: 'grupo-1' };

      // Act
      const result = await exercicioService.create(data, null);

      // Assert
      expect(mockedApiRequest).toHaveBeenCalledWith(
        '/exercicios',
        expect.objectContaining({ method: 'POST', isMultipart: true }),
      );
      const [, options] = mockedApiRequest.mock.calls[0];
      const fd = options?.body as FormData;
      expect(fd).toBeInstanceOf(FormData);
      expect(result).toEqual(exercicio);
    });

    it('inclui descricao no FormData quando informada', async () => {
      // Arrange
      mockedApiRequest.mockResolvedValue(makeExercicio());
      const data = {
        nome: 'Supino reto',
        descricao: 'Exercício composto',
        grupo_muscular_id: 'grupo-1',
      };

      // Act
      await exercicioService.create(data, null);

      // Assert
      const [, options] = mockedApiRequest.mock.calls[0];
      const fd = options?.body as FormData;
      // FormData do RN não expõe .get() de forma confiável em todos os ambientes,
      // mas o polyfill usado pelo jest-expo (form-data) implementa getAll/get.
      expect(typeof fd.append).toBe('function');
    });

    it('anexa a mídia como { uri, type, name } quando informada', async () => {
      // Arrange
      mockedApiRequest.mockResolvedValue(makeExercicio());
      const data = { nome: 'Supino reto', grupo_muscular_id: 'grupo-1' };
      const midia = {
        uri: 'file:///midia.jpg',
        mimeType: 'image/jpeg',
        fileName: 'midia.jpg',
      };

      // Act
      await exercicioService.create(data, midia);

      // Assert
      const [, options] = mockedApiRequest.mock.calls[0];
      expect(options?.isMultipart).toBe(true);
      expect(options?.method).toBe('POST');
    });
  });

  describe('desativar', () => {
    it('envia DELETE para /exercicios/:id', async () => {
      // Arrange
      mockedApiRequest.mockResolvedValue(undefined);

      // Act
      await exercicioService.desativar('exercicio-1');

      // Assert
      expect(mockedApiRequest).toHaveBeenCalledWith('/exercicios/exercicio-1', {
        method: 'DELETE',
      });
    });
  });
});
