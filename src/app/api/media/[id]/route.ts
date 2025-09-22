import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { adminDb, ensureUserDocumentExists } from '@/lib/firestore-admin';
import { MediaItem, MediaStatus, MediaType } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

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

// GET /api/media/[id] - Get specific media item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  
  if (!auth.success || !auth.userId) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  try {
    // Ensure user document exists in Firestore
    await ensureUserDocumentExists(auth.userId);

    const mediaCollection = adminDb.collection('users').doc(auth.userId).collection('media');
    const docRef = mediaCollection.doc(id);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Media item not found' },
        { status: 404 }
      );
    }

    const data = docSnapshot.data();
    const mediaItem: MediaItem = {
      // Handle both camelCase (new) and PascalCase (C# backend) field names
      mediaItemId: data?.mediaItemId || data?.MediaItemId || docSnapshot.id,
      name: data?.name || data?.Name,
      mediaType: mapMediaType(data?.mediaType || data?.MediaType),
      status: mapMediaStatus(data?.status || data?.Status),
      dateAdded: convertTimestamp(data?.dateAdded || data?.DateAdded) || new Date(),
      datePaused: convertTimestamp(data?.datePaused || data?.DatePaused),
      coverArtUrl: data?.coverArtUrl || data?.CoverArtUrl,
      // Handle progress with proper case mapping
      progress: data?.progress || data?.Progress ? {
        current: (data?.progress || data?.Progress)?.current || (data?.progress || data?.Progress)?.Current,
        total: (data?.progress || data?.Progress)?.total || (data?.progress || data?.Progress)?.Total
      } : { current: 0, total: undefined },
      // Handle additional progress with proper case mapping
      additionalProgress: data?.additionalProgress || data?.AdditionalProgress ? 
        mapAdditionalProgress(data?.additionalProgress || data?.AdditionalProgress) : {},
      external: data?.external || data?.External ? 
        mapExternalMetadata(data?.external || data?.External) : undefined,
      // Extract seasonInfo from either top-level or external.seasonInfo
      seasonInfo: data?.seasonInfo || data?.SeasonInfo || 
                  (data?.external?.seasonInfo) || (data?.External?.seasonInfo) || undefined,
    };

    return NextResponse.json(mediaItem);
  } catch (error) {
    console.error('Error fetching media item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media item' },
      { status: 500 }
    );
  }
}

// PUT /api/media/[id] - Update media item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  
  if (!auth.success || !auth.userId) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  try {
    const body = await request.json();
    console.log('PUT request body:', JSON.stringify(body, null, 2));
    
    // Ensure user document exists in Firestore
    await ensureUserDocumentExists(auth.userId);

    const mediaCollection = adminDb.collection('users').doc(auth.userId).collection('media');
    const docRef = mediaCollection.doc(id);
    
    // Check if document exists
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Media item not found' },
        { status: 404 }
      );
    }

    // Prepare the update data
    const updateData: any = {
      ...body,
      mediaItemId: id, // Ensure ID consistency
      dateAdded: docSnapshot.data()?.dateAdded || new Date(), // Preserve original dateAdded
    };

    // If status is being changed to Paused, set datePaused
    if (body.status === 'Paused' && docSnapshot.data()?.status !== 'Paused') {
      updateData.datePaused = new Date();
    }
    // If status is being changed from Paused to something else, remove datePaused field
    else if (body.status !== 'Paused' && docSnapshot.data()?.status === 'Paused') {
      updateData.datePaused = FieldValue.delete();
    }

    // Remove any undefined values to prevent Firestore errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log('Final update data:', JSON.stringify(updateData, null, 2));

    // Update the document
    await docRef.set(updateData, { merge: true });
    
    return NextResponse.json({ message: 'Media item updated successfully' });
  } catch (error) {
    console.error('Error updating media item:', error);
    return NextResponse.json(
      { error: 'Failed to update media item' },
      { status: 500 }
    );
  }
}

// DELETE /api/media/[id] - Delete media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  
  if (!auth.success || !auth.userId) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  try {
    // Ensure user document exists in Firestore
    await ensureUserDocumentExists(auth.userId);

    const mediaCollection = adminDb.collection('users').doc(auth.userId).collection('media');
    const docRef = mediaCollection.doc(id);
    
    // Check if document exists
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Media item not found' },
        { status: 404 }
      );
    }

    // Delete the document
    await docRef.delete();
    
    return NextResponse.json({ message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Error deleting media item:', error);
    return NextResponse.json(
      { error: 'Failed to delete media item' },
      { status: 500 }
    );
  }
}
