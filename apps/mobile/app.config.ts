import type { ExpoConfig, ConfigContext } from 'expo/config';

// Assets (icon, splash, adaptive-icon) ainda nao foram criados — Expo usa defaults.
// Adicionar em apps/mobile/assets/ antes do primeiro build EAS.

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'AMFIT',
  slug: 'amfit',
  version: '1.0.0',
  scheme: 'amfit',
  platforms: ['android', 'ios'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  android: {
    adaptiveIcon: {
      backgroundColor: '#f97316',
    },
    package: 'com.amfit.app',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.amfit.app',
  },
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'AMFIT precisa acessar suas fotos para você selecionar a mídia do exercício',
      },
    ],
    // Ícone/cor de notificação usam o default do Expo — trocar quando
    // houver asset dedicado em apps/mobile/assets/.
    'expo-notifications',
    // `splash` saiu do schema do app.config a partir do SDK 57 — a
    // configuração de splash screen agora só é aceita via esse plugin.
    [
      'expo-splash-screen',
      {
        resizeMode: 'contain',
        backgroundColor: '#f97316',
      },
    ],
    // `android.usesCleartextTraffic` saiu do schema do app.config a partir
    // do SDK 57 — agora é uma build property (expo-build-properties), não
    // mais um campo direto do Android config. Lab não tem TLS (API/MinIO em
    // http:// puro — ver infra/k8s/*/service.yaml); a partir do Android 9
    // dev-clients/APKs standalone bloqueiam cleartext por padrão. Reavaliar
    // quando o lab tiver TLS (Traefik).
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  // `extra.eas.projectId` ainda não existe — nenhum projeto Expo/EAS foi
  // criado pra esse app até agora. Sem ele, Notifications.getExpoPushTokenAsync
  // (features/notificacoes/lib/push.ts) não consegue gerar um token real e
  // registrarPushTokenExpo() sai cedo com um warning — mecanismo pronto,
  // mas push de verdade só funciona depois de rodar `eas init` (ou
  // `eas build:configure`) e esse ID aparecer aqui.
});
