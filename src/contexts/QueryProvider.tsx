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
            staleTime: 15 * 60 * 1000, // 15 minutes - keep data fresh longer
            gcTime: 60 * 60 * 1000, // 1 hour - keep data in cache much longer
            refetchOnWindowFocus: false, // Don't refetch when window gains focus
            refetchOnMount: false, // Don't refetch when component mounts if data exists
            refetchOnReconnect: false, // Don't refetch on network reconnect
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
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        buster: '', // You can use this to invalidate cache when app version changes
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
