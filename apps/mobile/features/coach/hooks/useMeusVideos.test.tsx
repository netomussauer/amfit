import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMeusVideos } from './useMeusVideos';
import { coachService } from '../services/coach.service';

jest.mock('../services/coach.service', () => ({
  coachService: { getMinhasVideos: jest.fn() },
}));

const mockedGetMinhasVideos = coachService.getMinhasVideos as jest.MockedFunction<
  typeof coachService.getMinhasVideos
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const responseFixture = { data: [], pagination: { total: 0, page: 1, per_page: 10 } };

describe('useMeusVideos', () => {
  beforeEach(() => {
    mockedGetMinhasVideos.mockReset();
  });

  it('busca os videos e repassa os params ao service', async () => {
    mockedGetMinhasVideos.mockResolvedValue(responseFixture);

    const params = { per_page: 10 };
    const { result } = renderHook(() => useMeusVideos(params), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetMinhasVideos).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(responseFixture);
  });
});
