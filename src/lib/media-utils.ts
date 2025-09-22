import { MediaItem, MediaType } from './types';

// Calculate which season and episode the user is actually watching based on their progress
const calculateCurrentSeasonAndEpisode = (item: MediaItem): { season: number; episode: number; episodesInSeason: number } => {
  if (!item.seasonInfo || !item.progress) {
    return { season: 1, episode: item.progress?.current ?? 0, episodesInSeason: 12 };
  }

  const startingSeason = item.seasonInfo.currentSeason || 1;
  const episodesPerSeason = item.seasonInfo.episodesInSeason || 12;
  const currentEpisodeInSeason = item.progress.current || 1;

  // Since currentProgress now represents episode within the selected season,
  // the current season is always the starting season (unless they've progressed beyond it)
  // For now, we'll assume they're still within the starting season
  return {
    season: startingSeason,
    episode: currentEpisodeInSeason,
    episodesInSeason: episodesPerSeason
  };
};

// Get display text for primary progress
export const getPrimaryProgressText = (item: MediaItem): string => {
  const current = item.progress?.current ?? 0;
  const total = item.progress?.total ?? 0;
  
  switch (item.mediaType) {
    case MediaType.Book:
      return `Page ${current} of ${total}`;
    case MediaType.Anime:
      if (item.seasonInfo?.currentSeason) {
        const { season, episode, episodesInSeason } = calculateCurrentSeasonAndEpisode(item);
        return `S${season}E${episode} of ${episodesInSeason}`;
      }
      return `Episode ${current} of ${total}`;
    case MediaType.Manga:
      return `Chapter ${current} of ${total}`;
    case MediaType.Show:
      if (item.seasonInfo?.currentSeason) {
        const { season, episode, episodesInSeason } = calculateCurrentSeasonAndEpisode(item);
        return `S${season}E${episode} of ${episodesInSeason}`;
      }
      // Fallback to old logic for backwards compatibility
      const fallbackSeason = item.additionalProgress?.seasons?.current ?? 1;
      return `Season ${fallbackSeason}, Episode ${current}`;
    default:
      return `${current} of ${total}`;
  }
};

// Get secondary progress text (if applicable)
export const getSecondaryProgressText = (item: MediaItem): string | null => {
  switch (item.mediaType) {
    case MediaType.Show:
    case MediaType.Anime:
      if (item.seasonInfo?.totalSeasons && item.seasonInfo.totalSeasons > 1) {
        const { season } = calculateCurrentSeasonAndEpisode(item);
        return `Season ${season} of ${item.seasonInfo.totalSeasons}`;
      }
      // Fallback to old logic for backwards compatibility
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

// Calculate progress percentage (for progress bars) - formatted to 1 decimal place
export const getProgressPercentage = (item: MediaItem): number => {
  const current = item.progress?.current ?? 0;
  let total = item.progress?.total ?? 0;
  
  // For season-aware media, calculate progress against the entire show
  if ((item.mediaType === MediaType.Show || item.mediaType === MediaType.Anime) && item.seasonInfo) {
    // current = episode within the selected season
    // Calculate absolute episode position: (seasonsWatched * episodesPerSeason) + currentEpisodeInSeason
    const episodeInSeason = current;
    const startingSeason = item.seasonInfo.currentSeason || 1;
    const episodesPerSeason = item.seasonInfo.episodesInSeason || 12;
    const totalSeasons = item.seasonInfo.totalSeasons || 1;
    
    // Episodes from previous seasons (before the starting season)
    const previousSeasonEpisodes = (startingSeason - 1) * episodesPerSeason;
    
    // Current absolute episode position
    const absoluteEpisode = previousSeasonEpisodes + episodeInSeason;
    
    // Total episodes in the entire show
    const totalShowEpisodes = totalSeasons * episodesPerSeason;
    
    if (totalShowEpisodes <= 0) return 0;
    
    const percentage = (absoluteEpisode / totalShowEpisodes) * 100;
    return Math.round(percentage * 10) / 10; // Round to 1 decimal place
  }
  
  if (total <= 0) return 0;
  
  const percentage = (current / total) * 100;
  return Math.round(percentage * 10) / 10; // Round to 1 decimal place
};

// Check if media type should show progress bar
export const shouldShowProgressBar = (mediaType: MediaType): boolean => {
  return mediaType === MediaType.Book || 
         mediaType === MediaType.Anime || 
         mediaType === MediaType.Manga || 
         mediaType === MediaType.Show;
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
