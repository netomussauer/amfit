import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { PLATAFORMA_DISPOSITIVO, RegistrarPushTokenRequestSchema } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

/**
 * A partir do SDK 53 do Expo, push remoto (notificação enviada pelo
 * servidor) no Android foi removido do Expo Go — o próprio pacote
 * `expo-notifications` lança um erro só por ser importado nesse cenário
 * (precisa de dev build). Checar isso ANTES de tentar importar evita pagar
 * o custo da tentativa (e logar o warning) toda vez: sem essa checagem,
 * tanto configurarNotificationHandler (chamada 1x por montagem da raiz do
 * app) quanto registrarPushTokenExpo (chamada 1x por login) reexecutariam
 * e recapturariam o mesmo erro sempre, já que um `require` que lança não
 * fica "cacheado" como bem-sucedido pelo Metro.
 */
function pushIndisponivelNesteAmbiente(): boolean {
  return (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

/**
 * `expo-notifications` nunca é importado estaticamente no topo do arquivo
 * — mesmo com a checagem acima, mantemos o require dentro de um try/catch
 * como rede de segurança (ex.: emulador sem Google Play Services, ou
 * qualquer outro cenário não coberto por pushIndisponivelNesteAmbiente).
 * Um `import` estático travaria qualquer tela que dependa (mesmo que
 * indiretamente, como a de login via useLogin) desse módulo, antes mesmo
 * dela renderizar.
 */
function getNotificationsModule(): typeof import('expo-notifications') | null {
  // pushIndisponivelNesteAmbiente() também entra no try: as funções deste
  // arquivo prometem nunca lançar, e essa checagem depende de
  // Constants.executionEnvironment (expo-constants) — se algum dia isso
  // vier undefined por qualquer motivo, o throw resultante não pode
  // escapar pra fora de configurarNotificationHandler/registrarPushTokenExpo.
  try {
    if (pushIndisponivelNesteAmbiente()) return null;
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch (err) {
    console.warn('[push] expo-notifications indisponível neste ambiente', err);
    return null;
  }
}

/**
 * Configura o handler de notificação em foreground — sem isso, o app não
 * mostra nada quando uma notificação chega com o app aberto (default do
 * Expo é não exibir). Chamada uma vez no mount da raiz do app
 * (app/_layout.tsx), independente de login: precisa rodar pra qualquer
 * sessão já autenticada que reabre o app direto (sem passar por
 * useLogin/registrarPushTokenExpo), já que é estado em memória que se
 * perde a cada reinício do processo JS.
 *
 * Nunca lança — mesmo tratamento de erro de registrarPushTokenExpo abaixo.
 */
export function configurarNotificationHandler(): void {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[push] falha ao configurar notification handler', err);
  }
}

/**
 * Pede permissão, obtém o token Expo Push do device e registra no backend
 * (POST /push-token). Chamada após login bem-sucedido (SDD roadmap:
 * "Registro de push_token no login — mobile").
 *
 * Nunca lança — qualquer falha (permissão negada, emulador sem Google
 * Play Services, projectId do Expo/EAS ainda não configurado, erro de
 * rede) é logada e ignorada. Notificação push é um recurso complementar;
 * uma falha aqui não pode quebrar o login.
 */
export async function registrarPushTokenExpo(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    if (!Device.isDevice) {
      // Emuladores/simuladores não recebem push de verdade — Notifications
      // lançaria um erro pedindo device físico.
      return;
    }

    const { status: existente } = await Notifications.getPermissionsAsync();
    let status = existente;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      // "notificação é silenciosa se não houver token" (SDD §13.2) — usuário
      // negou, seguimos sem registrar nada.
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        '[push] extra.eas.projectId não configurado em app.config.ts — pulando registro de push token (rode `eas init` primeiro)',
      );
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const body = RegistrarPushTokenRequestSchema.parse({
      token,
      plataforma: Platform.OS === 'ios' ? PLATAFORMA_DISPOSITIVO.IOS : PLATAFORMA_DISPOSITIVO.ANDROID,
    });

    await apiRequest('/push-token', { method: 'POST', body });
  } catch (err) {
    console.warn('[push] falha ao registrar push token', err);
  }
}
