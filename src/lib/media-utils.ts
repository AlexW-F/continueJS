import { MediaItem, MediaType } from './types';

// Calculate which season and episode the user is actually watching based on their progress
const calculateCurrentSeasonAndEpisode = (item: MediaItem): { season: number; episode: number; episodesInSeason: number } => {
  if (!item.seasonInfo || !item.progress) {
    return { season: 1, episode: item.progress?.current ?? 0, episodesInSeason: 12 };
  }

  // If we have the full season episode breakdown, calculate accurately
  if (item.seasonInfo.seasonEpisodes && item.seasonInfo.seasonEpisodes.length > 0) {
    const absoluteEpisode = item.progress.current || 0;
    let episodeCount = 0;
    
    // Find which season the absolute episode falls into
    for (let i = 0; i < item.seasonInfo.seasonEpisodes.length; i++) {
      const episodesInThisSeason = item.seasonInfo.seasonEpisodes[i];
      
      if (absoluteEpisode <= episodeCount + episodesInThisSeason) {
        // Found the season!
        return {
          season: i + 1,
          episode: absoluteEpisode - episodeCount,
          episodesInSeason: episodesInThisSeason
        };
      }
      
      episodeCount += episodesInThisSeason;
    }
    
    // If we've gone through all seasons, they're at the end
    const lastSeasonIndex = item.seasonInfo.seasonEpisodes.length - 1;
    return {
      season: lastSeasonIndex + 1,
      episode: item.seasonInfo.seasonEpisodes[lastSeasonIndex],
      episodesInSeason: item.seasonInfo.seasonEpisodes[lastSeasonIndex]
    };
  }

  // Fallback for items without full episode breakdown (backwards compatibility)
  const startingSeason = item.seasonInfo.currentSeason || 1;
  const episodesPerSeason = item.seasonInfo.episodesInSeason || 12;
  const currentEpisodeInSeason = item.progress.current || 1;

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
  
  // For season-aware media with season tracking enabled and episode breakdown available
  if ((item.mediaType === MediaType.Show || item.mediaType === MediaType.Anime) && item.seasonInfo) {
    // If we have the full episode breakdown, use actual stored progress
    if (item.seasonInfo.seasonEpisodes && item.seasonInfo.seasonEpisodes.length > 0) {
      // When season tracking is enabled with full episode breakdown:
      // - current = absolute episode number across all seasons (e.g., 34)
      // - total = total episodes across all seasons (e.g., 40)
      // - This shows progress through the entire show
      
      if (total <= 0) return 0;
      
      const percentage = (current / total) * 100;
      return Math.round(percentage * 10) / 10; // Round to 1 decimal place
    }
    
    // Fallback for legacy data without seasonEpisodes array
    // Assume current and total are in the context of the selected season
    // Calculate absolute progress: (seasons before current * eps per season) + current episode
    if (item.seasonInfo.currentSeason && item.seasonInfo.episodesInSeason && item.seasonInfo.totalSeasons) {
      const episodesPerSeason = item.seasonInfo.episodesInSeason;
      const currentSeason = item.seasonInfo.currentSeason;
      const totalSeasons = item.seasonInfo.totalSeasons;
      
      // For legacy data: current = episode in season, total = episodes in that season
      const episodeInSeason = current;
      const previousSeasonEpisodes = (currentSeason - 1) * episodesPerSeason;
      const absoluteEpisode = previousSeasonEpisodes + episodeInSeason;
      const totalShowEpisodes = totalSeasons * episodesPerSeason;
      
      if (totalShowEpisodes <= 0) return 0;
      
      const percentage = (absoluteEpisode / totalShowEpisodes) * 100;
      return Math.round(percentage * 10) / 10;
    }
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
