'use client';

import { MediaItem, MediaType, MediaStatus } from '@/lib/types';
import { 
  getPrimaryProgressText, 
  getSecondaryProgressText, 
  getProgressPercentage, 
  shouldShowProgressBar
} from '@/lib/media-utils';
import { formatSeasonDisplay } from '@/lib/season-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

interface MediaCardProps {
  media: MediaItem;
  onEdit: (media: MediaItem) => void;
  onDelete: (id: string) => void;
  onMarkCompleted?: (media: MediaItem) => void;
  className?: string;
}

export function MediaCard({ media, onEdit, onDelete, onMarkCompleted, className }: MediaCardProps) {
  const [imageError, setImageError] = useState(false);

  const getProgressText = (): string => {
    const primary = getPrimaryProgressText(media);
    const secondary = getSecondaryProgressText(media);
    
    if (secondary) {
      return `${primary} • ${secondary}`;
    }
    
    return primary;
  };

  const handleDelete = () => {
    if (media.mediaItemId && window.confirm(`Are you sure you want to delete "${media.name}"?`)) {
      onDelete(media.mediaItemId);
    }
  };

  const handleMarkCompleted = () => {
    if (onMarkCompleted && media.mediaItemId) {
      onMarkCompleted(media);
    }
  };

  const isCompleted = getProgressPercentage(media) >= 100;
  const isNotCompletedStatus = media.status !== MediaStatus.Completed;
  const shouldShowCompleteButton = isCompleted && isNotCompletedStatus;

  return (
    <Card className={`hover:shadow-md transition-shadow duration-200 ${className}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Cover Art */}
          <div className="flex-shrink-0">
            <div className="w-16 h-20 bg-gray-200 rounded-md overflow-hidden relative">
              {media.coverArtUrl && !imageError ? (
                <Image
                  src={media.coverArtUrl}
                  alt={media.name || 'Cover art'}
                  fill
                  className="object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  {media.mediaType}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate">
                  {media.name || 'Untitled'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {media.mediaType}
                  </p>
                  {/* Season Information */}
                  {(media.mediaType === MediaType.Show || media.mediaType === MediaType.Anime) && 
                   media.seasonInfo && media.seasonInfo.currentSeason && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{formatSeasonDisplay(media.seasonInfo)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(media)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Progress */}
            {media.progress && shouldShowProgressBar(media.mediaType) && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{getProgressText()}</span>
                  <span className="font-medium">{getProgressPercentage(media).toFixed(1)}%</span>
                </div>
                <Progress 
                  value={getProgressPercentage(media)} 
                  className={`h-2 ${
                    media.status === MediaStatus.InProgress ? 'progress-striped progress-in-progress' : 
                    media.status === MediaStatus.Paused ? 'progress-paused' :
                    media.status === MediaStatus.Completed ? 'progress-completed' :
                    media.status === MediaStatus.Archived ? 'progress-archived' :
                    ''
                  }`}
                />
              </div>
            )}

            {/* Mark as Completed Button */}
            {shouldShowCompleteButton && (
              <div className="mt-3">
                <Button
                  onClick={handleMarkCompleted}
                  size="sm"
                  className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Mark as Completed
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
