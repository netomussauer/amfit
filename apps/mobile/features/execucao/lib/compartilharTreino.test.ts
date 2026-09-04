import { createRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { capturarCardTreino, abrirShareSheet } from './compartilharTreino';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockedCaptureRef = captureRef as jest.MockedFunction<typeof captureRef>;
const mockedIsAvailable = Sharing.isAvailableAsync as jest.MockedFunction<
  typeof Sharing.isAvailableAsync
>;
const mockedShareAsync = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;

function refComElemento(): React.RefObject<View> {
  const ref = createRef<View>() as { current: View | null };
  ref.current = {} as View;
  return ref as React.RefObject<View>;
}

describe('capturarCardTreino', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCaptureRef.mockResolvedValue('file:///cache/card.png');
  });

  it('devolve null quando a ref ainda não está montada', async () => {
    const ref = createRef<View>();

    const uri = await capturarCardTreino(ref);

    expect(uri).toBeNull();
    expect(mockedCaptureRef).not.toHaveBeenCalled();
  });

  it('captura o card e devolve a uri do PNG', async () => {
    const ref = refComElemento();

    const uri = await capturarCardTreino(ref);

    expect(mockedCaptureRef).toHaveBeenCalledWith(ref, { format: 'png', quality: 1 });
    expect(uri).toBe('file:///cache/card.png');
  });

  it('nunca propaga erro — devolve null quando a captura falha', async () => {
    mockedCaptureRef.mockRejectedValue(new Error('capture failed'));
    const ref = refComElemento();

    await expect(capturarCardTreino(ref)).resolves.toBeNull();
  });
});

describe('abrirShareSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsAvailable.mockResolvedValue(true);
  });

  it('abre o share sheet quando disponível', async () => {
    await abrirShareSheet('file:///cache/card.png');

    expect(mockedShareAsync).toHaveBeenCalledWith('file:///cache/card.png', {
      mimeType: 'image/png',
      dialogTitle: 'Compartilhar treino',
    });
  });

  it('não chama shareAsync quando o compartilhamento não está disponível no device', async () => {
    mockedIsAvailable.mockResolvedValue(false);

    await abrirShareSheet('file:///cache/card.png');

    expect(mockedShareAsync).not.toHaveBeenCalled();
  });

  it('nunca propaga erro — falha ao compartilhar é engolida', async () => {
    mockedShareAsync.mockRejectedValue(new Error('share failed'));

    await expect(abrirShareSheet('file:///cache/card.png')).resolves.toBeUndefined();
  });
});
