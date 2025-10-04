'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useState, useEffect } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Consider data immediately stale for real-time updates
            gcTime: 30 * 60 * 1000, // 30 minutes - reduced cache time
            refetchOnWindowFocus: true, // Refetch when window gains focus
            refetchOnMount: true, // Refetch when component mounts
            refetchOnReconnect: true, // Refetch on network reconnect
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

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const persister = createSyncStoragePersister({
        storage: window.localStorage,
        key: 'continue-media-cache',
      });

      persistQueryClient({
        queryClient,
        persister,
        maxAge: 1 * 60 * 60 * 1000, // Reduced to 1 hour for faster sync
        buster: 'v2', // Invalidate old cache with real-time updates
      });
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
