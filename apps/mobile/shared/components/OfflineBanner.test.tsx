import { render, screen, act } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { OfflineBanner } from './OfflineBanner';
import { usePendingSyncCount } from '@/features/execucao/hooks/usePendingSyncCount';
import { useNeedsReauth } from '@/features/execucao/hooks/useNeedsReauth';

jest.mock('@/features/execucao/hooks/usePendingSyncCount');
jest.mock('@/features/execucao/hooks/useNeedsReauth');
const mockUsePendingSyncCount = usePendingSyncCount as jest.Mock;
const mockUseNeedsReauth = useNeedsReauth as jest.Mock;

// Timeouts esporádicos já observados neste ambiente sob carga (mesmo
// padrão visto em outros arquivos desta sessão — não é um teste
// específico travando, é o ambiente). Sobe o timeout padrão pro arquivo
// inteiro em vez de remendar teste por teste.
jest.setTimeout(20000);

describe('OfflineBanner', () => {
  beforeEach(() => {
    mockUsePendingSyncCount.mockReturnValue(0);
    mockUseNeedsReauth.mockReturnValue(false);
  });

  afterEach(async () => {
    await act(async () => {
      onlineManager.setOnline(true);
    });
  });

  it('não renderiza nada quando online e sem pendências', async () => {
    onlineManager.setOnline(true);

    await render(<OfflineBanner />);

    expect(screen.queryByText('Você está offline')).toBeNull();
  });

  it('mostra o aviso quando offline', async () => {
    onlineManager.setOnline(false);

    await render(<OfflineBanner />);

    expect(screen.getByText('Você está offline')).toBeTruthy();
  });

  it('mostra a contagem de pendências quando offline', async () => {
    onlineManager.setOnline(false);
    mockUsePendingSyncCount.mockReturnValue(3);

    await render(<OfflineBanner />);

    expect(screen.getByText('Você está offline · 3 ações pendentes')).toBeTruthy();
  });

  it('mostra aviso de sincronização quando online com fila pendente', async () => {
    onlineManager.setOnline(true);
    mockUsePendingSyncCount.mockReturnValue(2);

    await render(<OfflineBanner />);

    expect(screen.getByText('Sincronizando 2 ações...')).toBeTruthy();
  });

  it('mostra o aviso de reautenticação quando needsReauth e há pendências', async () => {
    onlineManager.setOnline(true);
    mockUsePendingSyncCount.mockReturnValue(2);
    mockUseNeedsReauth.mockReturnValue(true);

    await render(<OfflineBanner />);

    expect(screen.getByText('Entre novamente para sincronizar 2 ações')).toBeTruthy();
  });

  it('o aviso de reautenticação tem prioridade sobre a mensagem de offline', async () => {
    onlineManager.setOnline(false);
    mockUsePendingSyncCount.mockReturnValue(1);
    mockUseNeedsReauth.mockReturnValue(true);

    await render(<OfflineBanner />);

    expect(screen.getByText('Entre novamente para sincronizar 1 ação')).toBeTruthy();
    expect(screen.queryByText(/Você está offline/)).toBeNull();
  });

  it('não mostra aviso de reautenticação se a fila já estiver vazia', async () => {
    // needsReauth sem nenhum item pendente não deveria acontecer na
    // prática (a flag só é setada junto com um item que ficou preso na
    // fila), mas se acontecer não deve sequestrar a mensagem normal.
    onlineManager.setOnline(false);
    mockUsePendingSyncCount.mockReturnValue(0);
    mockUseNeedsReauth.mockReturnValue(true);

    await render(<OfflineBanner />);

    expect(screen.queryByText(/Entre novamente/)).toBeNull();
    expect(screen.getByText('Você está offline')).toBeTruthy();
  });

  it('some de novo quando volta a ficar online e a fila esvazia', async () => {
    onlineManager.setOnline(false);
    await render(<OfflineBanner />);
    expect(screen.getByText('Você está offline')).toBeTruthy();

    await act(async () => {
      onlineManager.setOnline(true);
    });

    expect(screen.queryByText('Você está offline')).toBeNull();
  });
});
