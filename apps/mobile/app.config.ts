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
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#f97316',
  },
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
  ],
});
