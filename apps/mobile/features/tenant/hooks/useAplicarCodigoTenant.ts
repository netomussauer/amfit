import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { CODIGO_CONVITE_REGEX, normalizarCodigoConvite } from '@amfit/shared';
import { ApiError, NetworkError } from '@/shared/lib/api-client';
import { tenantService } from '../services/tenant.service';
import { setPublicBranding } from '../lib/theme-cache';
import { requestThemeRefresh } from '../lib/theme-refresh';

/**
 * Aplica o código de convite de um personal (deep link `amfit://entrar/<codigo>`
 * ou digitado): valida o formato, busca a config pública, guarda no aparelho
 * e leva pro login já com a marca dele (ADR-007, nível 2).
 *
 * `aplicar` devolve `true` no sucesso (já navegou pro login) e `false` na
 * falha (com `erro` preenchido, sem navegar).
 */
export function useAplicarCodigoTenant() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = useCallback(
    async (entrada: string): Promise<boolean> => {
      const codigo = normalizarCodigoConvite(entrada);
      if (!CODIGO_CONVITE_REGEX.test(codigo)) {
        setErro('Código inválido. Ele tem 8 caracteres (letras e números).');
        return false;
      }

      setErro(null);
      setCarregando(true);
      try {
        const config = await tenantService.getConfigPublica(codigo);
        try {
          await setPublicBranding(codigo, config);
        } catch (err) {
          // O código é válido; o que falhou foi gravar no aparelho. Mensagem
          // própria em vez de dizer que não foi possível validar.
          console.warn('[tenant] falha ao guardar o convite no aparelho', err);
          setErro('Não foi possível salvar o convite neste aparelho. Tente novamente.');
          return false;
        }
        requestThemeRefresh();
        router.replace('/(auth)/login');
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setErro('Código não encontrado. Confira com o seu personal.');
        } else if (err instanceof NetworkError) {
          setErro('Sem conexão. Verifique sua internet e tente de novo.');
        } else if (err instanceof ApiError && err.status === 429) {
          setErro('Muitas tentativas. Aguarde um instante e tente de novo.');
        } else {
          setErro('Não foi possível validar o código agora. Tente novamente.');
        }
        return false;
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

  const limparErro = useCallback(() => setErro(null), []);

  return { aplicar, carregando, erro, limparErro };
}
