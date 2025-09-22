export enum MediaType {
  Book = "Book",
  Show = "Show",
  Anime = "Anime",
  Manga = "Manga"
}

export enum MediaStatus {
  InProgress = "InProgress",
  Paused = "Paused",
  Archived = "Archived",
  Completed = "Completed",
  Retired = "Retired"
}

export interface ProgressData {
  current?: number;
  total?: number;
}

export interface SeasonInfo {
  currentSeason?: number;           // Which season the user is watching/reading
  totalSeasons?: number;            // Total seasons available
  seasonName?: string;              // Custom season name (e.g., "Final Season Part 1")
  episodesInSeason?: number;        // Episodes in current season
  seasonYear?: number;              // Year the season aired
  seasonPeriod?: string;            // Spring/Summer/Fall/Winter for anime
}

export interface ExternalMetadata {
  id?: string;
  source?: string;
  score?: number;
  genres?: string[];
  synopsis?: string;
  seasonInfo?: SeasonInfo;          // Season-specific metadata
}

export interface MediaItem {
  // CORE FIELDS (Always Present)
  mediaItemId: string;           // Unique identifier
  name?: string;                 // Title of the media
  mediaType: MediaType;          // "Book" | "Show" | "Anime" | "Manga"
  status: MediaStatus;           // "InProgress" | "Paused" | "Archived" | "Completed" | "Retired"
  dateAdded: Date;               // Date object (converted from ISO string)
  datePaused?: Date;             // Date object (nullable, converted from ISO string)
  coverArtUrl?: string;          // Image URL (nullable)
  
  // SEASON TRACKING (for Shows/Anime)
  seasonInfo?: SeasonInfo;       // Season-specific information
  
  // DYNAMIC PROGRESS TRACKING
  progress?: ProgressData;       // Primary progress (meaning varies by type)
  additionalProgress?: Record<string, ProgressData>; // Secondary progress dimensions
  
  // EXTERNAL API METADATA
  external?: ExternalMetadata;   // Data from external APIs
  
  // Legacy fields for backwards compatibility
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isCompleted?: boolean;
  isRetired?: boolean;
  isActive?: boolean;
}

// Search result interfaces for external APIs
export interface AnimeSearchResult {
  mal_id: number;
  title: string;
  title_english?: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url?: string;
      large_image_url?: string;
    };
  };
  episodes?: number;
  score?: number;
  genres?: Array<{ name: string }>;
  synopsis?: string;
  status?: string;
  type?: string;
  season?: string;              // Spring/Summer/Fall/Winter
  year?: number;                // Year aired
}

export interface MangaSearchResult {
  mal_id: number;
  title: string;
  title_english?: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url?: string;
      large_image_url?: string;
    };
  };
  chapters?: number;
  volumes?: number;
  score?: number;
  genres?: Array<{ name: string }>;
  synopsis?: string;
  status?: string;
  type?: string;
}

export interface ShowSearchResult {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
}

// Extended show details from TMDB TV endpoint
export interface ShowDetailsResult {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  vote_average?: number;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Array<{
    season_number: number;
    name: string;
    episode_count: number;
    air_date?: string;
    poster_path?: string;
  }>;
}

export interface BookSearchResult {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    publishedDate?: string;
  };
}

// User authentication types
export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Kanban column types
export interface KanbanColumn {
  id: MediaStatus;
  title: string;
  items: MediaItem[];
  color: string;
}

// Form types for adding/editing media
export interface AddMediaFormData {
  name: string;
  mediaType: MediaType;
  coverArtUrl?: string;
  currentProgress?: number;
  totalProgress?: number;
  external?: ExternalMetadata;
  seasonInfo?: SeasonInfo;
}

export interface EditMediaFormData extends AddMediaFormData {
  mediaItemId: string;
  status: MediaStatus;
}

// External API configuration
export interface ExternalApiConfig {
  jikanBaseUrl: string;
  tmdbBaseUrl: string;
  tmdbApiKey: string;
  googleBooksBaseUrl: string;
  googleBooksApiKey: string;
}
