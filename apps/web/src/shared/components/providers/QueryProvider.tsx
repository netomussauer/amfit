'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/query-client';

type Props = {
  children: React.ReactNode;
};

export function QueryProvider({ children }: Props) {
  // One QueryClient per browser session — useState ensures it is not re-created on every render
  const [queryClient] = useState(() => createQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
