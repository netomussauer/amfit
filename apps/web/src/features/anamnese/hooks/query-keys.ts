// A anamnese é 1:1 com o aluno (upsert via POST, sem listagem/paginação),
// então a chave de detalhe é indexada só pelo alunoId.
export const anamneseKeys = {
  all: ['anamnese'] as const,
  details: () => [...anamneseKeys.all, 'detail'] as const,
  detail: (alunoId: string) => [...anamneseKeys.details(), alunoId] as const,
};
