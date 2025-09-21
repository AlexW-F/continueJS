'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000, // 10 minutes - longer stale time
            gcTime: 30 * 60 * 1000, // 30 minutes - keep data longer
            refetchOnWindowFocus: false, // Don't refetch when window gains focus
            refetchOnMount: false, // Don't refetch when component mounts if data exists
            refetchOnReconnect: 'always', // Only refetch on network reconnect
            retry: (failureCount, error) => {
              // Don't retry on 401/403 errors
              if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
                return false;
              }
              return failureCount < 2; // Reduce retry attempts
            },
          },
          mutations: {
            retry: 1, // Reduce mutation retries
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
