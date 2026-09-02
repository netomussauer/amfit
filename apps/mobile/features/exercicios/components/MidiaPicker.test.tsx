import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { MidiaPicker } from './MidiaPicker';
import type { MidiaInput } from '../services/exercicio.service';

// expo-image-picker e expo-video dependem de módulos nativos que o preset
// jest-expo não simula com o formato de dados que este componente espera
// (permissão/asset selecionado), então mockamos os dois módulos no nível do
// jest e testamos como o componente reage a cada resultado possível, sem
// depender da UI nativa do seletor em si.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { All: 'All' },
}));

jest.mock('expo-video', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useVideoPlayer: jest.fn(
      (
        _uri: string,
        configure?: (instance: { loop: boolean; muted: boolean }) => void,
      ) => {
        const instance = { loop: false, muted: false };
        configure?.(instance);
        return instance;
      },
    ),
    VideoView: View,
  };
});

const mockedRequestPermissions =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<
    typeof ImagePicker.requestMediaLibraryPermissionsAsync
  >;
const mockedLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

function grantPermission() {
  mockedRequestPermissions.mockResolvedValue({
    status: 'granted',
  } as ImagePicker.MediaLibraryPermissionResponse);
}

describe('MidiaPicker', () => {
  beforeEach(() => {
    mockedRequestPermissions.mockReset();
    mockedLaunchLibrary.mockReset();
  });

  it('exibe o botão de seleção e a dica de tamanho quando não há mídia', () => {
    // Act
    render(<MidiaPicker value={null} onChange={jest.fn()} />);

    // Assert
    expect(screen.getByRole('button', { name: 'Selecionar mídia do exercício' })).toBeTruthy();
    expect(screen.getByText('Imagem (até 5MB) ou vídeo (até 10MB).')).toBeTruthy();
  });

  it('exibe erro e não chama onChange quando a permissão de mídia é negada', async () => {
    // Arrange
    mockedRequestPermissions.mockResolvedValue({
      status: 'denied',
    } as ImagePicker.MediaLibraryPermissionResponse);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));

    // Assert
    expect(await screen.findByText('Permissão de acesso às fotos negada.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(mockedLaunchLibrary).not.toHaveBeenCalled();
  });

  it('não chama onChange quando a seleção é cancelada', async () => {
    // Arrange
    grantPermission();
    mockedLaunchLibrary.mockResolvedValue({ canceled: true, assets: null } as never);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));
    await Promise.resolve();

    // Assert
    expect(onChange).not.toHaveBeenCalled();
  });

  it('chama onChange com a imagem selecionada dentro do limite de tamanho', async () => {
    // Arrange
    grantPermission();
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///imagem.jpg',
          type: 'image',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          fileName: 'imagem.jpg',
        },
      ],
    } as never);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));

    // Assert
    await screen.findByRole('button', { name: 'Selecionar mídia do exercício' }, { timeout: 3000 });
    expect(onChange).toHaveBeenCalledWith({
      uri: 'file:///imagem.jpg',
      mimeType: 'image/jpeg',
      fileName: 'imagem.jpg',
    });
  });

  it('usa mimeType e fileName de fallback quando o asset não os informa', async () => {
    // Arrange
    grantPermission();
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///imagem.jpg', type: 'image', fileSize: 1024 }],
    } as never);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));
    await Promise.resolve();
    await Promise.resolve();

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    const midia = onChange.mock.calls[0][0] as MidiaInput;
    expect(midia.uri).toBe('file:///imagem.jpg');
    expect(midia.mimeType).toBe('image/jpeg');
    expect(midia.fileName).toMatch(/^midia-\d+\.jpg$/);
  });

  it('exibe erro e não chama onChange quando a imagem excede 5MB', async () => {
    // Arrange
    grantPermission();
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///imagem.jpg',
          type: 'image',
          fileSize: 6 * 1024 * 1024,
          mimeType: 'image/jpeg',
          fileName: 'imagem.jpg',
        },
      ],
    } as never);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));

    // Assert
    expect(
      await screen.findByText('A imagem deve ter no máximo 5MB.'),
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('exibe erro e não chama onChange quando o vídeo excede 10MB', async () => {
    // Arrange
    grantPermission();
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///video.mp4',
          type: 'video',
          fileSize: 11 * 1024 * 1024,
          mimeType: 'video/mp4',
          fileName: 'video.mp4',
        },
      ],
    } as never);
    const onChange = jest.fn();
    render(<MidiaPicker value={null} onChange={onChange} />);

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Selecionar mídia do exercício' }));

    // Assert
    expect(await screen.findByText('O vídeo deve ter no máximo 10MB.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renderiza a pré-visualização da imagem e permite trocar/remover quando há valor', () => {
    // Arrange
    const value: MidiaInput = {
      uri: 'file:///imagem.jpg',
      mimeType: 'image/jpeg',
      fileName: 'imagem.jpg',
    };
    const onChange = jest.fn();
    render(<MidiaPicker value={value} onChange={onChange} />);

    // Assert
    expect(
      screen.getByLabelText('Pré-visualização da imagem selecionada'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trocar mídia' })).toBeTruthy();

    // Act
    fireEvent.press(screen.getByRole('button', { name: 'Remover mídia' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renderiza a pré-visualização de vídeo quando o mimeType é de vídeo', () => {
    // Arrange
    const value: MidiaInput = {
      uri: 'file:///video.mp4',
      mimeType: 'video/mp4',
      fileName: 'video.mp4',
    };

    // Act
    render(<MidiaPicker value={value} onChange={jest.fn()} />);

    // Assert
    expect(
      screen.getByLabelText('Pré-visualização do vídeo selecionado'),
    ).toBeTruthy();
  });
});
