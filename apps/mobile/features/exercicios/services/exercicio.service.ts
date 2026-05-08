import type { ExercicioResponse, GrupoMuscular } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export type CriarExercicioInput = {
  nome: string;
  descricao?: string;
  grupo_muscular_id: string;
};

export type MidiaInput = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export type ListarExerciciosParams = {
  grupo_muscular_id?: string;
  busca?: string;
};

export const exercicioService = {
  listGrupos: () => apiRequest<GrupoMuscular[]>('/grupos-musculares'),

  list: (params: ListarExerciciosParams) =>
    apiRequest<{ data: ExercicioResponse[] }>('/exercicios', { params }),

  getById: (id: string) => apiRequest<ExercicioResponse>(`/exercicios/${id}`),

  create: async (data: CriarExercicioInput, midia: MidiaInput | null) => {
    const fd = new FormData();
    fd.append('nome', data.nome);
    if (data.descricao) fd.append('descricao', data.descricao);
    fd.append('grupo_muscular_id', data.grupo_muscular_id);
    if (midia) {
      // React Native FormData aceita objeto { uri, type, name } — diferente do FormData web.
      fd.append('midia', {
        uri: midia.uri,
        type: midia.mimeType,
        name: midia.fileName,
      } as unknown as Blob);
    }
    return apiRequest<ExercicioResponse>('/exercicios', {
      method: 'POST',
      body: fd,
      isMultipart: true,
    });
  },
};
