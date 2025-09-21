import { MediaItem, MediaType } from './types';

// Get display text for primary progress
export const getPrimaryProgressText = (item: MediaItem): string => {
  const current = item.progress?.current ?? 0;
  const total = item.progress?.total ?? 0;
  
  switch (item.mediaType) {
    case MediaType.Book:
      return `Page ${current} of ${total}`;
    case MediaType.Anime:
      return `Episode ${current} of ${total}`;
    case MediaType.Manga:
      return `Chapter ${current} of ${total}`;
    case MediaType.Show:
      const season = item.additionalProgress?.seasons?.current ?? 1;
      return `Season ${season}, Episode ${current}`;
    default:
      return `${current} of ${total}`;
  }
};

// Get secondary progress text (if applicable)
export const getSecondaryProgressText = (item: MediaItem): string | null => {
  switch (item.mediaType) {
    case MediaType.Show:
      const totalSeasons = item.additionalProgress?.seasons?.total ?? 0;
      if (totalSeasons > 0) {
        return `(of ${totalSeasons} seasons)`;
      }
      return null;
    case MediaType.Manga:
      const volumes = item.additionalProgress?.volumes;
      if (volumes?.total && volumes.total > 0) {
        return `Volume ${volumes.current ?? 0} of ${volumes.total}`;
      }
      return null;
    default:
      return null;
  }
};

// Calculate progress percentage (for progress bars)
export const getProgressPercentage = (item: MediaItem): number => {
  const current = item.progress?.current ?? 0;
  const total = item.progress?.total ?? 0;
  
  if (total <= 0) return 0;
  return Math.min((current / total) * 100, 100);
};

// Check if media type should show progress bar
export const shouldShowProgressBar = (mediaType: MediaType): boolean => {
  return mediaType === MediaType.Book || mediaType === MediaType.Anime || mediaType === MediaType.Manga;
};

// Get progress bar color based on status
export const getProgressBarColor = (status: string): string => {
  switch (status) {
    case "InProgress": return "bg-blue-500"; // Blue with potential stripes
    case "Paused": return "bg-gray-500";     // Gray
    case "Archived": return "bg-gray-300";   // Light gray
    case "Completed": return "bg-green-500"; // Green (always 100%)
    case "Retired": return "bg-red-500";     // Red
    default: return "bg-blue-500";
  }
};

// Get full progress text combining primary and secondary
export const getFullProgressText = (item: MediaItem): string => {
  const primary = getPrimaryProgressText(item);
  const secondary = getSecondaryProgressText(item);
  
  if (secondary) {
    return `${primary} ${secondary}`;
  }
  
  return primary;
};
