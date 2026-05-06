import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'AMFIT',
  slug: 'amfit',
  version: '1.0.0',
  scheme: 'amfit',
  platforms: ['android', 'ios'],
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#f97316',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
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
  plugins: ['expo-router', 'expo-secure-store'],
});
