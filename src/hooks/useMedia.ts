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
      return failureCount < 3;
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

      const mediaItem: MediaItem = {
        mediaItemId: uuidv4(),
        name: data.name,
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

      await mediaService.addMedia(mediaItem);
      return mediaItem;
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

      await mediaService.updateMedia(updatedMedia);
      return updatedMedia;
    },
    onSuccess: (updatedMedia) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.map(item => item.mediaItemId === updatedMedia.mediaItemId ? updatedMedia : item)
      );
      toast.success('Media updated successfully!');
    },
    onError: (error) => {
      console.error('Failed to update media:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to update media.');
      } else {
        toast.error('Failed to update media. Please try again.');
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
        throw new Error('Media item not found');
      }

      const updatedMedia: MediaItem = {
        ...currentMedia,
        status: newStatus,
        datePaused: newStatus === MediaStatus.Paused ? new Date() : currentMedia.datePaused,
      };

      await mediaService.updateMedia(updatedMedia);
      return updatedMedia;
    },
    onSuccess: (updatedMedia) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.map(item => item.mediaItemId === updatedMedia.mediaItemId ? updatedMedia : item)
      );
    },
    onError: (error) => {
      console.error('Failed to update media status:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to update media.');
      } else {
        toast.error('Failed to update media status. Please try again.');
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
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['media', user?.uid], (old: MediaItem[] = []) =>
        old.filter(item => item.mediaItemId !== deletedId)
      );
      toast.success('Media deleted successfully!');
    },
    onError: (error) => {
      console.error('Failed to delete media:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        toast.error('Please sign in to delete media.');
      } else {
        toast.error('Failed to delete media. Please try again.');
      }
    },
  });
}
