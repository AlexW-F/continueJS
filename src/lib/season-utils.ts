import { SeasonInfo, AnimeSearchResult, ShowDetailsResult } from './types';

/**
 * Extracts season information from anime title
 * Handles formats like "Title Season 2", "Title S2", "Title: Season 2", etc.
 */
export function extractSeasonFromAnimeTitle(title: string): { seasonNumber?: number; cleanTitle: string } {
  const patterns = [
    /^(.+?)\s+Season\s+(\d+)$/i,
    /^(.+?)\s+S(\d+)$/i,
    /^(.+?):\s*Season\s+(\d+)$/i,
    /^(.+?)\s+(\d+)(?:nd|rd|th)?\s+Season$/i,
    /^(.+?)\s+Part\s+(\d+)$/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return {
        seasonNumber: parseInt(match[2], 10),
        cleanTitle: match[1].trim()
      };
    }
  }

  // No season found in title
  return { cleanTitle: title };
}

/**
 * Creates season info from anime search result
 */
export function createSeasonInfoFromAnime(anime: AnimeSearchResult): SeasonInfo {
  const { seasonNumber, cleanTitle } = extractSeasonFromAnimeTitle(anime.title);
  
  return {
    currentSeason: seasonNumber,
    seasonName: seasonNumber ? `Season ${seasonNumber}` : undefined,
    episodesInSeason: anime.episodes,
    seasonYear: anime.year,
    seasonPeriod: anime.season,
  };
}

/**
 * Creates season info from show details
 * currentSeason represents which season the user is starting from
 */
export function createSeasonInfoFromShow(show: ShowDetailsResult, selectedSeasonNumber?: number): SeasonInfo {
  const totalSeasons = show.number_of_seasons;
  const currentSeason = selectedSeasonNumber || 1;
  
  // Find the selected season
  const season = show.seasons.find(s => s.season_number === currentSeason);
  
  // Extract episode counts for all seasons (excluding season 0 - specials)
  const seasonEpisodes = show.seasons
    .filter(s => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map(s => s.episode_count);
  
  const episodesInSeason = season?.episode_count || 12;
  
  return {
    currentSeason,
    totalSeasons,
    seasonName: season?.name || `Season ${currentSeason}`,
    episodesInSeason,
    seasonYear: season?.air_date ? new Date(season.air_date).getFullYear() : undefined,
    seasonEpisodes, // Store full episode breakdown for all seasons
  };
}

/**
 * Formats season display for UI
 */
export function formatSeasonDisplay(seasonInfo: SeasonInfo): string {
  if (!seasonInfo.currentSeason) {
    return '';
  }

  const parts: string[] = [];
  
  if (seasonInfo.seasonName) {
    parts.push(seasonInfo.seasonName);
  } else {
    parts.push(`Season ${seasonInfo.currentSeason}`);
  }
  
  if (seasonInfo.totalSeasons && seasonInfo.totalSeasons > 1) {
    parts.push(`(${seasonInfo.currentSeason}/${seasonInfo.totalSeasons})`);
  }
  
  if (seasonInfo.seasonYear) {
    parts.push(`(${seasonInfo.seasonYear})`);
  }
  
  return parts.join(' ');
}

/**
 * Gets season options for a show
 */
export function getSeasonOptions(show: ShowDetailsResult): Array<{ value: number; label: string; episodes: number }> {
  return show.seasons
    .filter(season => season.season_number > 0) // Exclude specials (season 0)
    .map(season => ({
      value: season.season_number,
      label: season.name || `Season ${season.season_number}`,
      episodes: season.episode_count
    }))
    .sort((a, b) => a.value - b.value);
}

/**
 * Suggests related seasons for anime (heuristic-based)
 */
export function suggestAnimeSeasons(anime: AnimeSearchResult): string[] {
  const { seasonNumber, cleanTitle } = extractSeasonFromAnimeTitle(anime.title);
  
  if (!seasonNumber) {
    return [];
  }
  
  // Suggest common season patterns
  const suggestions: string[] = [];
  
  // Previous seasons
  for (let i = 1; i < seasonNumber; i++) {
    suggestions.push(`${cleanTitle} Season ${i}`);
  }
  
  // Next seasons (common patterns)
  if (seasonNumber < 5) { // Don't suggest too many future seasons
    for (let i = seasonNumber + 1; i <= seasonNumber + 2; i++) {
      suggestions.push(`${cleanTitle} Season ${i}`);
    }
  }
  
  return suggestions;
}

/**
 * Calculates the starting episode offset when user begins tracking from a specific season
 * If user starts from Season 3, they've already watched Seasons 1-2
 * Season 3 with 12 eps/season = episodes 1-24 already watched, starting from episode 25
 */
export function calculateSeasonStartingOffset(seasonInfo: SeasonInfo): number {
  const startingSeason = seasonInfo.currentSeason || 1;
  const episodesPerSeason = seasonInfo.episodesInSeason || 12;
  
  // Episodes watched = (starting_season - 1) * episodes_per_season
  return (startingSeason - 1) * episodesPerSeason;
}

/**
 * Calculates total episodes across all seasons of a show
 */
export function calculateTotalShowEpisodes(seasonInfo: SeasonInfo): number {
  const totalSeasons = seasonInfo.totalSeasons || 1;
  const episodesPerSeason = seasonInfo.episodesInSeason || 12;
  
  // For simplicity, assume all seasons have same episode count
  // In production, you'd want to fetch actual episode counts per season
  return totalSeasons * episodesPerSeason;
}

/**
 * Converts user's current progress to absolute episode number in the entire show
 * If user is on Season 3 Episode 5, and they selected Season 3 as starting point:
 * - Episodes 1-24 are considered watched (Seasons 1-2)
 * - Current episode = 24 + 5 = 29
 */
export function calculateAbsoluteEpisode(
  userCurrentProgress: number,
  seasonInfo: SeasonInfo
): number {
  const startingOffset = calculateSeasonStartingOffset(seasonInfo);
  return startingOffset + userCurrentProgress;
}

/**
 * Converts absolute episode number back to season/episode display
 * Episode 29 with 12 eps/season = Season 3 Episode 5
 */
export function absoluteEpisodeToSeasonEpisode(
  absoluteEpisode: number, 
  episodesPerSeason: number = 12
): { season: number; episode: number } {
  const season = Math.floor((absoluteEpisode - 1) / episodesPerSeason) + 1;
  const episode = ((absoluteEpisode - 1) % episodesPerSeason) + 1;
  return { season, episode };
}

/**
 * Updates progress for season-aware media with absolute episode tracking
 * Returns the current season/episode they're watching and total progress
 */
export function updateSeasonProgress(
  userCurrentProgress: number,
  seasonInfo: SeasonInfo
): { 
  episode: number; 
  season: number; 
  isSeasonComplete: boolean; 
  totalProgress: number;
  absoluteEpisode: number;
} {
  const episodesPerSeason = seasonInfo.episodesInSeason || 12;
  const absoluteEpisode = calculateAbsoluteEpisode(userCurrentProgress, seasonInfo);
  const { season, episode } = absoluteEpisodeToSeasonEpisode(absoluteEpisode, episodesPerSeason);
  
  const isSeasonComplete = episode === episodesPerSeason;
  
  return { 
    episode, 
    season, 
    isSeasonComplete,
    totalProgress: userCurrentProgress,
    absoluteEpisode
  };
}