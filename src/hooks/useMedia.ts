'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MediaItem, MediaStatus, AddMediaFormData, EditMediaFormData } from '@/lib/types';
import { mediaService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

export function useMedia() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['media', user?.uid],
    queryFn: () => mediaService.getMedia(),
    enabled: !!user, // Only run query when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if user is not authenticated
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return false;
      }
      // Don't retry if it's an index building error - user should wait
      if (error instanceof Error && error.message.includes('index is currently building')) {
        return false;
      }
      return failureCount < 3;
    },
    refetchInterval: (query) => {
      // If there's an index building error, refetch every 30 seconds
      if (query?.state.error && String(query.state.error).includes('index is currently building')) {
        return 30000; // 30 seconds
      }
      return false;
    },
  });
}

export function useAddMedia() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: AddMediaFormData) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const mediaItemId = uuidv4();
      
      const mediaItem: MediaItem = {
        mediaItemId,
        name: data.name, // This is guaranteed to be a string from AddMediaFormData
        mediaType: data.mediaType,
        status: MediaStatus.InProgress,
        dateAdded: new Date(),
        coverArtUrl: data.coverArtUrl,
        progress: {
          current: data.currentProgress || 0,
          total: data.totalProgress,
        },
        external: data.external,
      };

      // Send the complete media item to the API (including the UUID)
      const result = await mediaService.addMedia(mediaItem);
      
      // Use the ID returned from the API (should match our generated UUID)
      return { ...mediaItem, mediaItemId: result || mediaItemId };
    },
    onSuccess: (newMedia) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) => [...old, newMedia]);
      toast.success('Media added successfully!');
    },
    onError: (error) => {
      console.error('Failed to add media:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to add media.');
      } else {
        toast.error('Failed to add media. Please try again.');
      }
    },
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: EditMediaFormData) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get current media item to preserve fields not in the form
      const currentMedia = queryClient.getQueryData<MediaItem[]>(['media', user.uid])
        ?.find(item => item.mediaItemId === data.mediaItemId);

      if (!currentMedia) {
        throw new Error('Media item not found');
      }

      const updatedMedia: MediaItem = {
        ...currentMedia,
        name: data.name,
        mediaType: data.mediaType,
        status: data.status,
        coverArtUrl: data.coverArtUrl,
        progress: {
          current: data.currentProgress || 0,
          total: data.totalProgress,
        },
        external: data.external,
        datePaused: data.status === MediaStatus.Paused ? new Date() : currentMedia.datePaused,
      };

      // Convert to EditMediaFormData for the API call
      const apiData: EditMediaFormData = {
        mediaItemId: data.mediaItemId,
        name: data.name,
        mediaType: data.mediaType,
        status: data.status,
        coverArtUrl: data.coverArtUrl,
        currentProgress: data.currentProgress,
        totalProgress: data.totalProgress,
        external: data.external,
      };

      await mediaService.updateMedia(apiData);
      return updatedMedia;
    },
    // Optimistic update: immediately update the cache before the API call
    onMutate: async (data) => {
      if (!user) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media', user.uid] });

      // Snapshot the previous value
      const previousMedia = queryClient.getQueryData<MediaItem[]>(['media', user.uid]);

      // Get current media item to preserve fields not in the form
      const currentMedia = previousMedia?.find(item => item.mediaItemId === data.mediaItemId);

      if (currentMedia) {
        const optimisticUpdate: MediaItem = {
          ...currentMedia,
          name: data.name,
          mediaType: data.mediaType,
          status: data.status,
          coverArtUrl: data.coverArtUrl,
          progress: {
            current: data.currentProgress || 0,
            total: data.totalProgress,
          },
          external: data.external,
          datePaused: data.status === MediaStatus.Paused ? new Date() : currentMedia.datePaused,
        };

        // Optimistically update the cache
        queryClient.setQueryData(['media', user.uid], (old: MediaItem[] = []) =>
          old.map(item => item.mediaItemId === data.mediaItemId ? optimisticUpdate : item)
        );
      }

      return { previousMedia };
    },
    onSuccess: (updatedMedia) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.map(item => item.mediaItemId === updatedMedia.mediaItemId ? updatedMedia : item)
      );
      toast.success('Media updated successfully!');
    },
    onError: (error, variables, context) => {
      // Rollback to the previous state if the mutation fails
      if (context?.previousMedia && user) {
        queryClient.setQueryData(['media', user.uid], context.previousMedia);
      }

      console.error('Failed to update media:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to update media.');
      } else {
        toast.error('Failed to update media. Please try again.');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['media', user.uid] });
      }
    },
  });
}

export function useUpdateMediaStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ mediaId, newStatus }: { mediaId: string; newStatus: MediaStatus }) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get current media item
      const currentMedia = queryClient.getQueryData<MediaItem[]>(['media', user.uid])
        ?.find(item => item.mediaItemId === mediaId);

      if (!currentMedia) {
        console.error('Media item not found in local cache:', mediaId);
        console.log('Available media items:', queryClient.getQueryData<MediaItem[]>(['media', user.uid])?.map(item => item.mediaItemId));
        throw new Error('Media item not found in local cache');
      }

      console.log('Updating media status:', { mediaId, currentStatus: currentMedia.status, newStatus });

      const updatedMedia: MediaItem = {
        ...currentMedia,
        status: newStatus,
        datePaused: newStatus === MediaStatus.Paused ? new Date() : currentMedia.datePaused,
      };

      // Convert to EditMediaFormData for the API call
      const apiData: EditMediaFormData = {
        mediaItemId: currentMedia.mediaItemId,
        name: currentMedia.name || '', // Ensure name is not undefined
        mediaType: currentMedia.mediaType,
        status: newStatus,
        coverArtUrl: currentMedia.coverArtUrl,
        currentProgress: currentMedia.progress?.current,
        totalProgress: currentMedia.progress?.total,
        external: currentMedia.external,
      };

      await mediaService.updateMedia(apiData);
      return updatedMedia;
    },
    // Optimistic update: immediately update the cache before the API call
    onMutate: async ({ mediaId, newStatus }) => {
      if (!user) return;
      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['media', user.uid] });

      // Snapshot the previous value for rollback
      const previousMedia = queryClient.getQueryData<MediaItem[]>(['media', user.uid]);

      // Optimistically update the cache
      queryClient.setQueryData(['media', user.uid], (old: MediaItem[] = []) =>
        old.map(item => {
          if (item.mediaItemId === mediaId) {
            return {
              ...item,
              status: newStatus,
              datePaused: newStatus === MediaStatus.Paused ? new Date() : item.datePaused,
            };
          }
          return item;
        })
      );

      // Return a context object with the snapshotted value
      return { previousMedia };
    },
    onSuccess: (updatedMedia) => {
      // The cache is already updated optimistically, but we can ensure consistency
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.map(item => item.mediaItemId === updatedMedia.mediaItemId ? updatedMedia : item)
      );
    },
    onError: (error, variables, context) => {
      // Rollback to the previous state if the mutation fails
      if (context?.previousMedia && user) {
        queryClient.setQueryData(['media', user.uid], context.previousMedia);
      }

      console.error('Failed to update media status:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to update media.');
      } else if (error instanceof Error && error.message.includes('404')) {
        toast.error('Media item not found. It may have been deleted.');
        // Refetch media to sync local state with database
        queryClient.invalidateQueries({ queryKey: ['media', user?.uid] });
      } else if (error instanceof Error && error.message.includes('local cache')) {
        toast.error('Media item not found locally. Refreshing...');
        // Refetch media to sync local state with database
        queryClient.invalidateQueries({ queryKey: ['media', user?.uid] });
      } else {
        toast.error('Failed to update media status. Please try again.');
      }
    },
    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['media', user.uid] });
      }
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      await mediaService.deleteMedia(mediaId);
      return mediaId;
    },
    // Optimistic update: immediately remove from cache
    onMutate: async (mediaId) => {
      if (!user) return;
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['media', user.uid] });

      // Snapshot the previous value
      const previousMedia = queryClient.getQueryData<MediaItem[]>(['media', user.uid]);

      // Optimistically update the cache by removing the item
      queryClient.setQueryData(['media', user.uid], (old: MediaItem[] = []) =>
        old.filter(item => item.mediaItemId !== mediaId)
      );

      return { previousMedia };
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.filter(item => item.mediaItemId !== deletedId)
      );
      toast.success('Media deleted successfully!');
    },
    onError: (error, variables, context) => {
      // Rollback to the previous state if the mutation fails
      if (context?.previousMedia && user) {
        queryClient.setQueryData(['media', user.uid], context.previousMedia);
      }

      console.error('Failed to delete media:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to delete media.');
      } else {
        toast.error('Failed to delete media. Please try again.');
      }
    },
    onSettled: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['media', user.uid] });
      }
    },
  });
}
