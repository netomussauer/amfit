import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from '@/shared/lib/api-client';
import { registrarPushTokenExpo, configurarNotificationHandler } from './push';

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedGetPermissions = Notifications.getPermissionsAsync as jest.MockedFunction<
  typeof Notifications.getPermissionsAsync
>;
const mockedRequestPermissions = Notifications.requestPermissionsAsync as jest.MockedFunction<
  typeof Notifications.requestPermissionsAsync
>;
const mockedGetToken = Notifications.getExpoPushTokenAsync as jest.MockedFunction<
  typeof Notifications.getExpoPushTokenAsync
>;
const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedDevice = Device as { isDevice: boolean };

describe('configurarNotificationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configura o handler de notificação em foreground', () => {
    configurarNotificationHandler();

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('nunca lança — falha ao configurar o handler é engolida', () => {
    (Notifications.setNotificationHandler as jest.MockedFunction<
      typeof Notifications.setNotificationHandler
    >).mockImplementation(() => {
      throw new Error('módulo indisponível nesta versão do Expo Go');
    });

    expect(() => configurarNotificationHandler()).not.toThrow();
  });
});

describe('registrarPushTokenExpo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDevice.isDevice = true;
    Constants.expoConfig = { extra: { eas: { projectId: 'test-project-id' } } } as never;
    mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);
    mockedGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' } as never);
    mockedApiRequest.mockResolvedValue(undefined as never);
  });

  it('não faz nada em emulador/simulador (Device.isDevice=false)', async () => {
    mockedDevice.isDevice = false;

    await registrarPushTokenExpo();

    expect(mockedGetPermissions).not.toHaveBeenCalled();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('não registra token quando o usuário nega a permissão', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'denied' } as never);
    mockedRequestPermissions.mockResolvedValue({ status: 'denied' } as never);

    await registrarPushTokenExpo();

    expect(mockedRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockedGetToken).not.toHaveBeenCalled();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('pede permissão só quando ainda não concedida', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'granted' } as never);

    await registrarPushTokenExpo();

    expect(mockedRequestPermissions).not.toHaveBeenCalled();
  });

  it('não registra token quando projectId do Expo/EAS não está configurado', async () => {
    Constants.expoConfig = { extra: {} } as never;

    await registrarPushTokenExpo();

    expect(mockedGetToken).not.toHaveBeenCalled();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('registra o token no backend quando tudo está disponível', async () => {
    await registrarPushTokenExpo();

    expect(mockedGetToken).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(mockedApiRequest).toHaveBeenCalledWith('/push-token', {
      method: 'POST',
      body: { token: 'ExponentPushToken[abc]', plataforma: expect.stringMatching(/^(ANDROID|IOS)$/) },
    });
  });

  it('nunca propaga erro — falha de rede é engolida', async () => {
    mockedApiRequest.mockRejectedValue(new Error('network down'));

    await expect(registrarPushTokenExpo()).resolves.toBeUndefined();
  });
});
