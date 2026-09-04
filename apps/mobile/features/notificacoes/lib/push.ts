import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PLATAFORMA_DISPOSITIVO, RegistrarPushTokenRequestSchema } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

// Comportamento em foreground — sem isso, o app não mostra nada quando uma
// notificação chega com o app aberto (default do Expo é não exibir).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
