import {
  MediaItem,
  AnimeSearchResult,
  MangaSearchResult,
  ShowSearchResult,
  BookSearchResult,
  MediaType,
  MediaStatus
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Firestore Service for data persistence with Firebase Authentication
class FirestoreService {
  private readonly COLLECTION_NAME = 'mediaItems';

  private async getCurrentUserId(): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    return auth.currentUser.uid;
  }

  private async getIdToken(): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    return await auth.currentUser.getIdToken();
  }

  async getMediaItems(): Promise<MediaItem[]> {
    try {
      const userId = await this.getCurrentUserId();
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const items: MediaItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          ...data,
          mediaItemId: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as MediaItem);
      });
      
      return items;
    } catch (error) {
      console.error('Error fetching media items:', error);
      throw error;
    }
  }

  async addMediaItem(item: MediaItem): Promise<string> {
    try {
      const userId = await this.getCurrentUserId();
      await this.getIdToken(); // Verify token is valid
      
      const now = Timestamp.now();
      const itemWithMetadata = {
        ...item,
        userId,
        createdAt: now,
        updatedAt: now,
      };
      
      // Remove mediaItemId if it exists (Firestore will generate it)
      const { mediaItemId: _mediaItemId, ...itemToAdd } = itemWithMetadata;
      
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), itemToAdd);
      return docRef.id;
    } catch (error) {
      console.error('Error adding media item:', error);
      throw error;
    }
  }

  async updateMediaItem(updatedItem: MediaItem): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      await this.getIdToken(); // Verify token is valid
      
      if (!updatedItem.mediaItemId) {
        throw new Error('Media item ID is required for update');
      }

      const docRef = doc(db, this.COLLECTION_NAME, updatedItem.mediaItemId);
      const updateData = {
        ...updatedItem,
        userId,
        updatedAt: Timestamp.now(),
      };
      
      // Remove mediaItemId from update data
      const { mediaItemId: _mediaItemId, ...dataToUpdate } = updateData;
      
      await updateDoc(docRef, dataToUpdate);
    } catch (error) {
      console.error('Error updating media item:', error);
      throw error;
    }
  }

  async deleteMediaItem(mediaItemId: string): Promise<void> {
    try {
      await this.getIdToken(); // Verify token is valid
      
      const docRef = doc(db, this.COLLECTION_NAME, mediaItemId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting media item:', error);
      throw error;
    }
  }
}

// Media Service - handles all media-related operations with Firestore and Firebase Authentication
export class MediaService {
  private storage = new FirestoreService();

  async getIdToken(): Promise<string | null> {
    try {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch (error) {
      console.warn('Failed to get ID token:', error);
    }
    return null;
  }

  async getMedia(): Promise<MediaItem[]> {
    return await this.storage.getMediaItems();
  }

  async addMedia(item: MediaItem): Promise<void> {
    // Ensure the item has an ID
    if (!item.mediaItemId) {
      item.mediaItemId = uuidv4();
    }
    
    await this.storage.addMediaItem(item);
  }

  async updateMedia(item: MediaItem): Promise<void> {
    await this.storage.updateMediaItem(item);
  }

  async deleteMedia(mediaItemId: string): Promise<void> {
    await this.storage.deleteMediaItem(mediaItemId);
  }
}

// Search Service - handles external API searches
class SearchService {
  private jikanBaseUrl = 'https://api.jikan.moe/v4';
  private tmdbBaseUrl = 'https://api.themoviedb.org/3';
  private googleBooksBaseUrl = 'https://www.googleapis.com/books/v1';
  
  private tmdbApiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  private googleBooksApiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;

  async searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
      const response = await fetch(
        `${this.jikanBaseUrl}/anime?q=${encodeURIComponent(query)}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search anime');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Anime search failed:', error);
      return [];
    }
  }

  async searchManga(query: string): Promise<MangaSearchResult[]> {
    try {
      const response = await fetch(
        `${this.jikanBaseUrl}/manga?q=${encodeURIComponent(query)}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search manga');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Manga search failed:', error);
      return [];
    }
  }

  async searchShows(query: string): Promise<ShowSearchResult[]> {
    try {
      if (!this.tmdbApiKey) {
        console.warn('TMDB API key not configured');
        return [];
      }

      const response = await fetch(
        `${this.tmdbBaseUrl}/search/tv?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search shows');
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Shows search failed:', error);
      return [];
    }
  }

  async searchBooks(query: string): Promise<BookSearchResult[]> {
    try {
      const url = this.googleBooksApiKey 
        ? `${this.googleBooksBaseUrl}/volumes?q=${encodeURIComponent(query)}&key=${this.googleBooksApiKey}&maxResults=10`
        : `${this.googleBooksBaseUrl}/volumes?q=${encodeURIComponent(query)}&maxResults=10`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to search books');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Books search failed:', error);
      return [];
    }
  }
}

// Helper functions to convert search results to MediaItem format
export function convertAnimeToMediaItem(anime: AnimeSearchResult): MediaItem {
  return {
    mediaItemId: uuidv4(),
    name: anime.title || anime.title_english || 'Unknown Title',
    mediaType: MediaType.Anime,
    status: MediaStatus.InProgress,
    dateAdded: new Date(),
    coverArtUrl: anime.images?.jpg?.image_url,
    progress: {
      current: 0,
      total: anime.episodes || undefined,
    },
    external: {
      id: anime.mal_id?.toString(),
      source: 'MyAnimeList',
      score: anime.score,
      genres: anime.genres?.map(g => g.name) || [],
      synopsis: anime.synopsis,
    },
  };
}

export function convertMangaToMediaItem(manga: MangaSearchResult): MediaItem {
  return {
    mediaItemId: uuidv4(),
    name: manga.title || manga.title_english || 'Unknown Title',
    mediaType: MediaType.Manga,
    status: MediaStatus.InProgress,
    dateAdded: new Date(),
    coverArtUrl: manga.images?.jpg?.image_url,
    progress: {
      current: 0,
      total: manga.chapters || undefined,
    },
    external: {
      id: manga.mal_id?.toString(),
      source: 'MyAnimeList',
      score: manga.score,
      genres: manga.genres?.map(g => g.name) || [],
      synopsis: manga.synopsis,
    },
  };
}

export function convertShowToMediaItem(show: ShowSearchResult): MediaItem {
  return {
    mediaItemId: uuidv4(),
    name: show.name || 'Unknown Title',
    mediaType: MediaType.Show,
    status: MediaStatus.InProgress,
    dateAdded: new Date(),
    coverArtUrl: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined,
    progress: {
      current: 0,
      total: show.number_of_episodes || undefined,
    },
    external: {
      id: show.id?.toString(),
      source: 'TMDB',
      score: show.vote_average,
      genres: show.genre_ids?.map(id => id.toString()) || [],
      synopsis: show.overview,
    },
  };
}

export function convertBookToMediaItem(book: BookSearchResult): MediaItem {
  const volumeInfo = book.volumeInfo;
  return {
    mediaItemId: uuidv4(),
    name: volumeInfo?.title || 'Unknown Title',
    mediaType: MediaType.Book,
    status: MediaStatus.InProgress,
    dateAdded: new Date(),
    coverArtUrl: volumeInfo?.imageLinks?.thumbnail,
    progress: {
      current: 0,
      total: volumeInfo?.pageCount || undefined,
    },
    external: {
      id: book.id,
      source: 'Google Books',
      score: volumeInfo?.averageRating,
      genres: volumeInfo?.categories || [],
      synopsis: volumeInfo?.description,
    },
  };
}

// Singleton instances
export const mediaService = new MediaService();
export const searchService = new SearchService();
