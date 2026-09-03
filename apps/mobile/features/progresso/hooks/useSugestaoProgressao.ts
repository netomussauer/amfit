import { useQuery } from '@tanstack/react-query';
import { progressoService } from '../services/progresso.service';
import { progressoKeys } from './query-keys';

/**
 * Sugestão de progressão de carga (progressive overload) pra um
 * exercício específico, calculada comparando as duas últimas sessões
 * concluídas do aluno autenticado.
 *
 * `staleTime` mais curto que useMeuProgresso (histórico completo) porque
 * a sugestão é consumida no fluxo de execução — uma sessão recém-
 * concluída deve refletir na próxima consulta sem esperar 60s.
 */
export function useSugestaoProgressao(exercicioId: string | undefined) {
  return useQuery({
    queryKey: progressoKeys.sugestao(exercicioId ?? ''),
    queryFn: () => {
      if (!exercicioId) throw new Error('exercicioId obrigatório');
      return progressoService.getMinhaSugestao(exercicioId);
    },
    enabled: !!exercicioId,
    staleTime: 15 * 1000,
  });
}
