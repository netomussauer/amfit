import { apiRequest } from '@/shared/lib/api-client';
import { execucaoService } from './execucao.service';
import {
  makeRegistroSerieResponse,
  makeSessaoListResponse,
  makeSessaoResponse,
} from '../__fixtures__/execucao.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('execucaoService.iniciar', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('envia POST /sessoes com o treino_id informado', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedApiRequest.mockResolvedValue(sessao);

    // Act
    const result = await execucaoService.iniciar(sessao.treino_id);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith('/sessoes', {
      method: 'POST',
      body: { treino_id: sessao.treino_id },
    });
    expect(result).toEqual(sessao);
  });

  it('lança erro quando o treino_id não é um uuid válido', async () => {
    // Act / Assert
    await expect(execucaoService.iniciar('nao-e-um-uuid')).rejects.toThrow();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('lança erro quando a resposta da API não corresponde ao schema esperado', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue({ id: 'nao-e-um-uuid' });

    // Act / Assert
    await expect(
      execucaoService.iniciar('60000000-0000-0000-0000-000000000001'),
    ).rejects.toThrow();
  });
});

describe('execucaoService.buscar', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca a sessão no endpoint /sessoes/:id', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedApiRequest.mockResolvedValue(sessao);

    // Act
    const result = await execucaoService.buscar(sessao.id);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith(`/sessoes/${sessao.id}`);
    expect(result).toEqual(sessao);
  });
});

describe('execucaoService.registrarSerie', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('envia PATCH /sessoes/:id/series com o corpo validado', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    const registro = makeRegistroSerieResponse();
    const body = {
      item_treino_id: registro.item_treino_id,
      numero_serie: registro.numero_serie,
      concluida: true,
      carga_realizada: 82.5,
      repeticoes_realizadas: 8,
    };
    mockedApiRequest.mockResolvedValue({ ...registro, ...body });

    // Act
    const result = await execucaoService.registrarSerie(sessao.id, body);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith(`/sessoes/${sessao.id}/series`, {
      method: 'PATCH',
      body,
    });
    expect(result).toMatchObject(body);
  });

  it('lança erro e não chama apiRequest quando o corpo é inválido', async () => {
    // Arrange — numero_serie fora do intervalo permitido (1-20)
    const body = {
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 99,
      concluida: false,
      carga_realizada: null,
      repeticoes_realizadas: null,
    };

    // Act / Assert
    await expect(
      execucaoService.registrarSerie('50000000-0000-0000-0000-000000000001', body),
    ).rejects.toThrow();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});

describe('execucaoService.concluir', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('envia PATCH /sessoes/:id/concluir', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ status: 'CONCLUIDO' });
    mockedApiRequest.mockResolvedValue(sessao);

    // Act
    const result = await execucaoService.concluir(sessao.id);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith(`/sessoes/${sessao.id}/concluir`, {
      method: 'PATCH',
    });
    expect(result).toEqual(sessao);
  });
});

describe('execucaoService.listarMinhasSessoes', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca /alunos/me/sessoes repassando page e per_page', async () => {
    // Arrange
    const response = makeSessaoListResponse();
    mockedApiRequest.mockResolvedValue(response);

    // Act
    const result = await execucaoService.listarMinhasSessoes(2, 10);

    // Assert
    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me/sessoes', {
      params: { page: 2, per_page: 10 },
    });
    expect(result).toEqual(response);
  });

  it('lança erro quando a resposta da API não corresponde ao schema esperado', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue({ data: [], pagination: {} });

    // Act / Assert
    await expect(execucaoService.listarMinhasSessoes(1, 20)).rejects.toThrow();
  });
});
