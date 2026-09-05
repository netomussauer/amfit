import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { coachService } from '../services/coach.service';
import { useVideosDoPersonal } from './useVideosDoPersonal';

vi.mock('../services/coach.service', () => ({
  coachService: { listVideos: vi.fn() },
}));

const mockedListVideos = vi.mocked(coachService.listVideos);

describe('useVideosDoPersonal', () => {
  beforeEach(() => {
    mockedListVideos.mockReset();
  });

  it('busca os videos com os parametros informados', async () => {
    const responseFixture = { data: [], pagination: { total: 0, page: 1, per_page: 20 } };
    mockedListVideos.mockResolvedValueOnce(responseFixture);

    const params = { page: 1, perPage: 20, status: 'AGUARDANDO_FEEDBACK' };
    const { result } = renderHook(() => useVideosDoPersonal(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListVideos).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(responseFixture);
  });
});
