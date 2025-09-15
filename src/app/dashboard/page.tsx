'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { KanbanBoard } from '@/components/media/KanbanBoard';
import { AddMediaDialog } from '@/components/media/AddMediaDialog';
import { EditMediaDialog } from '@/components/media/EditMediaDialog';
import { useMedia, useAddMedia, useUpdateMedia, useUpdateMediaStatus, useDeleteMedia } from '@/hooks/useMedia';
import { MediaItem, MediaStatus, AddMediaFormData, EditMediaFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardContent() {
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: media = [], isLoading, error } = useMedia();
  const addMediaMutation = useAddMedia();
  const updateMediaMutation = useUpdateMedia();
  const updateStatusMutation = useUpdateMediaStatus();
  const deleteMediaMutation = useDeleteMedia();

  const handleAddMedia = (data: AddMediaFormData) => {
    addMediaMutation.mutate(data);
  };

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setEditDialogOpen(true);
  };

  const handleUpdateMedia = (data: EditMediaFormData) => {
    updateMediaMutation.mutate(data);
  };

  const handleUpdateStatus = (mediaId: string, newStatus: MediaStatus) => {
    updateStatusMutation.mutate({ mediaId, newStatus });
  };

  const handleDeleteMedia = (id: string) => {
    deleteMediaMutation.mutate(id);
  };

  const activeMedia = media.filter((item: MediaItem) => 
    item.status === MediaStatus.InProgress || 
    item.status === MediaStatus.Paused || 
    item.status === MediaStatus.Archived
  );

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Error loading media</h2>
          <p className="text-muted-foreground">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Track your progress across all your media
            </p>
          </div>
          
          <AddMediaDialog onAdd={handleAddMedia}>
            <Button size="lg" disabled={addMediaMutation.isPending}>
              {addMediaMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Media
            </Button>
          </AddMediaDialog>
        </div>

        {isLoading ? (
          <div className="flex gap-6 overflow-x-auto pb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-1 min-w-80">
                <div className="border rounded-lg p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-24 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {media.length === 0 ? (
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-semibold mb-2">No media yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start tracking your books, anime, manga, and TV shows by adding your first item.
                  </p>
                  <AddMediaDialog onAdd={handleAddMedia}>
                    <Button size="lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Media
                    </Button>
                  </AddMediaDialog>
                </div>
              </div>
            ) : (
              <KanbanBoard
                media={activeMedia}
                onUpdateStatus={handleUpdateStatus}
                onEdit={handleEditMedia}
                onDelete={handleDeleteMedia}
              />
            )}
          </>
        )}
      </main>

      <EditMediaDialog
        media={editingMedia}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onEdit={handleUpdateMedia}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
