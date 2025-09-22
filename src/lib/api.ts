import {
  MediaItem,
  AnimeSearchResult,
  MangaSearchResult,
  ShowSearchResult,
  ShowDetailsResult,
  BookSearchResult,
  MediaType,
  MediaStatus,
  AddMediaFormData,
  EditMediaFormData
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { auth } from './firebase';

// API Service for our custom Next.js backend
class ApiService {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    let idToken = null;
    
    if (user) {
      try {
        idToken = await user.getIdToken();
      } catch (error) {
        console.error('Error getting ID token:', error);
        throw new Error('User not authenticated');
      }
    } else {
      throw new Error('User not authenticated');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    };
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract data from our API response format { success: true, data: [...] }
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    
    // If it's not wrapped in our standard format, return as-is
    return result;
  }

  // Media API methods
  async getMedia(): Promise<MediaItem[]> {
    return this.request<MediaItem[]>('/media');
  }

  async addMedia(mediaItem: MediaItem): Promise<string> {
    const response = await fetch('/api/media', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(mediaItem),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result.mediaItemId || result.data?.mediaItemId || mediaItem.mediaItemId;
  }

  async updateMedia(formData: EditMediaFormData): Promise<void> {
    if (!formData.mediaItemId) {
      throw new Error('Media item ID is required for update');
    }

    const mediaItem: Partial<MediaItem> = {
      mediaItemId: formData.mediaItemId,
      name: formData.name,
      mediaType: formData.mediaType,
      status: formData.status,
      coverArtUrl: formData.coverArtUrl,
      progress: {
        current: formData.currentProgress,
        total: formData.totalProgress,
      },
      external: formData.external,
    };
    
    await this.request(`/media/${formData.mediaItemId}`, {
      method: 'PUT',
      body: JSON.stringify(mediaItem),
    });
  }

  async deleteMedia(id: string): Promise<void> {
    await this.request(`/media/${id}`, {
      method: 'DELETE',
    });
  }

  // Search API methods - these will use external APIs through our backend
  async searchAnime(query: string): Promise<AnimeSearchResult[]> {
    return this.request<AnimeSearchResult[]>(`/search/anime?query=${encodeURIComponent(query)}`);
  }

  async searchManga(query: string): Promise<MangaSearchResult[]> {
    return this.request<MangaSearchResult[]>(`/search/manga?query=${encodeURIComponent(query)}`);
  }

  async searchShows(query: string): Promise<ShowSearchResult[]> {
    return this.request<ShowSearchResult[]>(`/search/shows?query=${encodeURIComponent(query)}`);
  }

  async searchBooks(query: string): Promise<BookSearchResult[]> {
    return this.request<BookSearchResult[]>(`/search/books?query=${encodeURIComponent(query)}`);
  }

  async getShowDetails(id: string): Promise<ShowDetailsResult> {
    return this.request<ShowDetailsResult>(`/media/show-details/${id}`);
  }
}

// Create singleton instance
export const mediaService = new ApiService();

// Backwards compatibility - export both as mediaService and searchService
export const searchService = mediaService;