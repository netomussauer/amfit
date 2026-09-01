import { useQuery } from '@tanstack/react-query';
import type { AlunoResponse } from '@amfit/shared';
import { meuPerfilService } from '../services/meu-perfil.service';
import { meuPerfilKeys } from './query-keys';

export function useMeuPerfil() {
  return useQuery<AlunoResponse>({
    queryKey: meuPerfilKeys.detail(),
    queryFn: () => meuPerfilService.buscar(),
    staleTime: 5 * 60 * 1000,
  });
}
