import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { adminDb, ensureUserDocumentExists } from '@/lib/firestore-admin';
import { MediaItem, MediaStatus, MediaType } from '@/lib/types';

// Helper functions to map C# backend data to TypeScript enums
function mapMediaType(value: unknown): MediaType {
  if (typeof value === 'string') {
    return value as MediaType;
  }
  // Map numeric values from C# backend
  switch (value) {
    case 0: return MediaType.Book;
    case 1: return MediaType.Show;
    case 2: return MediaType.Anime;
    case 3: return MediaType.Manga;
    default: return MediaType.Book;
  }
}

function mapMediaStatus(value: unknown): MediaStatus {
  if (typeof value === 'string') {
    return value as MediaStatus;
  }
  // Map numeric values from C# backend
  switch (value) {
    case 0: return MediaStatus.InProgress;
    case 1: return MediaStatus.Paused;
    case 2: return MediaStatus.Archived;
    case 3: return MediaStatus.Completed;
    case 4: return MediaStatus.Retired;
    default: return MediaStatus.InProgress;
  }
}

function convertTimestamp(value: unknown): Date | undefined {
  if (!value) return undefined;
  
  // Handle Firestore Timestamp objects
  const timestampValue = value as { _seconds?: number; _nanoseconds?: number; toDate?: () => Date };
  if (timestampValue._seconds !== undefined) {
    return new Date(timestampValue._seconds * 1000 + (timestampValue._nanoseconds || 0) / 1000000);
  }
  
  // Handle Date objects or date strings
  if (timestampValue.toDate) {
    return timestampValue.toDate();
  }
  
  return new Date(value as string | number | Date);
}

function mapAdditionalProgress(value: unknown): Record<string, { current?: number; total?: number }> {
  if (!value) return {};
  
  // Handle nested progress objects with potential case differences
  const result: Record<string, { current?: number; total?: number }> = {};
  
  if (typeof value === 'object' && value !== null) {
    for (const [key, progressValue] of Object.entries(value)) {
      if (progressValue && typeof progressValue === 'object') {
        const progress = progressValue as { current?: number; total?: number; Current?: number; Total?: number };
        result[key] = {
          current: progress.current || progress.Current,
          total: progress.total || progress.Total
        };
      }
    }
  }
  
  return result;
}

function mapExternalMetadata(value: unknown): { id?: string; source?: string; score?: number; genres?: string[]; synopsis?: string } | undefined {
  if (!value) return undefined;
  
  const metadata = value as { id?: string; source?: string; score?: number; genres?: string[]; synopsis?: string; Id?: string; Source?: string; Score?: number; Genres?: string[]; Synopsis?: string };
  
  return {
    id: metadata.id || metadata.Id,
    source: metadata.source || metadata.Source,
    score: metadata.score || metadata.Score,
    genres: metadata.genres || metadata.Genres,
    synopsis: metadata.synopsis || metadata.Synopsis
  };
}

// GET /api/media - Get user's media items
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  
  if (!auth.success || !auth.userId) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  try {
    // Ensure user document exists in Firestore
    await ensureUserDocumentExists(auth.userId);

    const mediaList: MediaItem[] = [];
    const mediaCollection = adminDb.collection('users').doc(auth.userId).collection('media');
    const snapshot = await mediaCollection.get();
    
    snapshot.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data();
        
        // Map C# backend field names to TypeScript interface
        const item: MediaItem = {
          // Handle both camelCase (new) and PascalCase (C# backend) field names
          mediaItemId: data.mediaItemId || data.MediaItemId || doc.id,
          name: data.name || data.Name,
          mediaType: mapMediaType(data.mediaType || data.MediaType),
          status: mapMediaStatus(data.status || data.Status),
          dateAdded: convertTimestamp(data.dateAdded || data.DateAdded) || new Date(),
          datePaused: convertTimestamp(data.datePaused || data.DatePaused),
          coverArtUrl: data.coverArtUrl || data.CoverArtUrl,
          // Handle progress with proper case mapping
          progress: data.progress || data.Progress ? {
            current: (data.progress || data.Progress)?.current || (data.progress || data.Progress)?.Current,
            total: (data.progress || data.Progress)?.total || (data.progress || data.Progress)?.Total
          } : { current: 0, total: undefined },
          // Handle additional progress with proper case mapping
          additionalProgress: data.additionalProgress || data.AdditionalProgress ? 
            mapAdditionalProgress(data.additionalProgress || data.AdditionalProgress) : {},
          external: data.external || data.External ? 
            mapExternalMetadata(data.external || data.External) : undefined,
          // Extract seasonInfo from either top-level or external.seasonInfo
          seasonInfo: data.seasonInfo || data.SeasonInfo || 
                      (data.external?.seasonInfo) || (data.External?.seasonInfo) || undefined,
        };
        
        mediaList.push(item);
      }
    });
    
    return NextResponse.json(mediaList);
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media items' },
      { status: 500 }
    );
  }
}

// POST /api/media - Add new media item
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  
  if (!auth.success || !auth.userId) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.mediaType) {
      return NextResponse.json(
        { error: 'Name and mediaType are required' },
        { status: 400 }
      );
    }

    // Ensure user document exists in Firestore
    await ensureUserDocumentExists(auth.userId);

    // Create MediaItem with proper structure
    const mediaItem: any = {
      mediaItemId: body.mediaItemId || adminDb.collection('users').doc(auth.userId).collection('media').doc().id,
      name: body.name,
      mediaType: body.mediaType,
      status: body.status || MediaStatus.InProgress,
      dateAdded: new Date(),
      coverArtUrl: body.coverArtUrl,
      progress: body.progress || { current: 0, total: undefined },
      additionalProgress: body.additionalProgress || {},
      external: body.external,
      seasonInfo: body.seasonInfo, // Add seasonInfo support
    };

    // Only add datePaused if it exists
    if (body.datePaused) {
      mediaItem.datePaused = new Date(body.datePaused);
    }

    // Remove undefined values for Firestore compatibility
    const cleanForFirestore = (obj: unknown): Record<string, unknown> | unknown => {
      if (obj === null || obj === undefined) {
        return null;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(cleanForFirestore);
      }
      
      if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = cleanForFirestore(value);
          }
        }
        return cleaned;
      }
      
      return obj;
    };

    const firestoreData = cleanForFirestore(mediaItem) as Record<string, unknown>;
    
    const mediaCollection = adminDb.collection('users').doc(auth.userId).collection('media');
    
    // Use the MediaItemId as the document ID to ensure consistency
    const docRef = mediaCollection.doc(mediaItem.mediaItemId);
    
    await docRef.set(firestoreData);
    
    return NextResponse.json({ mediaItemId: mediaItem.mediaItemId }, { status: 201 });
  } catch (error) {
    console.error('Error adding media:', error);
    return NextResponse.json(
      { error: 'Failed to add media item' },
      { status: 500 }
    );
  }
}
