import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { ShowDetailsResult } from '@/lib/types';

// GET /api/media/show-details/[id] - Get detailed show information including seasons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  
  if (!auth.success) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  const { id: showId } = await params;

  if (!showId) {
    return NextResponse.json(
      { success: false, error: 'Show ID is required' },
      { status: 400 }
    );
  }

  const tmdbApiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!tmdbApiKey) {
    return NextResponse.json(
      { success: false, error: 'TMDB API key not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${tmdbApiKey}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data as ShowDetailsResult,
    });
  } catch (error) {
    console.error('Error fetching show details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch show details' },
      { status: 500 }
    );
  }
}