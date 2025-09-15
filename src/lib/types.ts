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

export interface ExternalMetadata {
  id?: string;
  source?: string;
  score?: number;
  genres?: string[];
  synopsis?: string;
}

export interface MediaItem {
  mediaItemId?: string; // Optional because Firestore generates it
  name?: string;
  mediaType: MediaType;
  status: MediaStatus;
  dateAdded: Date;
  datePaused?: Date;
  coverArtUrl?: string;
  progress?: ProgressData;
  additionalProgress?: Record<string, ProgressData>; // For volumes, seasons, etc.
  external?: ExternalMetadata;
  userId?: string; // Added for Firestore user association
  createdAt?: Date; // Added for Firestore timestamps
  updatedAt?: Date; // Added for Firestore timestamps
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
