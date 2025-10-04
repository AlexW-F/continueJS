'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { MediaCard } from '@/components/media/MediaCard';
import { EditMediaDialog } from '@/components/media/EditMediaDialog';
import { useMedia, useUpdateMedia, useDeleteMedia } from '@/hooks/useMedia';
import { MediaItem, MediaStatus, EditMediaFormData, MediaType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle } from 'lucide-react';

function CompletedContent() {
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | MediaType>('all');
  const [sortBy, setSortBy] = useState<'dateAdded' | 'name' | 'type'>('dateAdded');

  const { data: media = [], isLoading, error } = useMedia();
  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();

  const completedMedia = media
    .filter((item: MediaItem) => item.status === MediaStatus.Completed)
    .filter((item: MediaItem) => filterType === 'all' || item.mediaType === filterType)
    .sort((a: MediaItem, b: MediaItem) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'type':
          return a.mediaType.localeCompare(b.mediaType);
        case 'dateAdded':
        default:
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    });

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setEditDialogOpen(true);
  };

  const handleUpdateMedia = (data: EditMediaFormData) => {
    updateMediaMutation.mutate(data);
  };

  const handleDeleteMedia = (id: string) => {
    deleteMediaMutation.mutate(id);
  };

  const getCompletionStats = () => {
    type StatsType = {
      total: number;
      [MediaType.Book]: number;
      [MediaType.Anime]: number;
      [MediaType.Manga]: number;
      [MediaType.Show]: number;
    };
    
    const stats = media.reduce((acc: StatsType, item: MediaItem) => {
      if (item.status === MediaStatus.Completed) {
        acc[item.mediaType] = (acc[item.mediaType] || 0) + 1;
        acc.total++;
      }
      return acc;
    }, {
      total: 0,
      [MediaType.Book]: 0,
      [MediaType.Anime]: 0,
      [MediaType.Manga]: 0,
      [MediaType.Show]: 0,
    });

    return stats;
  };

  const stats = getCompletionStats();

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
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <h1 className="text-3xl font-bold text-foreground">Completed</h1>
          </div>
          <p className="text-muted-foreground">
            Your finished media collection ({stats.total} items)
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-card rounded-lg p-4 border">
            <div className="text-2xl font-bold text-green-600">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <div className="text-2xl font-bold">{stats[MediaType.Book]}</div>
            <div className="text-sm text-muted-foreground">Books</div>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <div className="text-2xl font-bold">{stats[MediaType.Anime]}</div>
            <div className="text-sm text-muted-foreground">Anime</div>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <div className="text-2xl font-bold">{stats[MediaType.Manga]}</div>
            <div className="text-sm text-muted-foreground">Manga</div>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <div className="text-2xl font-bold">{stats[MediaType.Show]}</div>
            <div className="text-sm text-muted-foreground">TV Shows</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-type" className="text-sm font-medium">Filter:</label>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as 'all' | MediaType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={MediaType.Book}>Books</SelectItem>
                <SelectItem value={MediaType.Anime}>Anime</SelectItem>
                <SelectItem value={MediaType.Manga}>Manga</SelectItem>
                <SelectItem value={MediaType.Show}>TV Shows</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort-by" className="text-sm font-medium">Sort by:</label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'dateAdded' | 'name' | 'type')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateAdded">Date Added</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <>
            {completedMedia.length === 0 ? (
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No completed media yet</h3>
                  <p className="text-muted-foreground">
                    {filterType === 'all' 
                      ? "Items you mark as completed will appear here."
                      : `No completed ${filterType.toLowerCase()} found.`
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {completedMedia.map((media: MediaItem) => (
                  <MediaCard
                    key={media.mediaItemId}
                    media={media}
                    onEdit={handleEditMedia}
                    onDelete={handleDeleteMedia}
                  />
                ))}
              </div>
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

export default function CompletedPage() {
  return (
    <ProtectedRoute>
      <CompletedContent />
    </ProtectedRoute>
  );
}
