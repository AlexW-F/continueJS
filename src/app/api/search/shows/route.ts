import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { ShowSearchResult } from '@/lib/types';

// GET /api/search/shows - Search for TV shows using TMDB API
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  
  if (!auth.success) {
    return createAuthResponse(auth.error || 'Authentication required');
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query parameter is required' },
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
      `https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&query=${encodeURIComponent(query)}`,
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
      data: data.results as ShowSearchResult[],
    });
  } catch (error) {
    console.error('Error searching shows:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search shows' },
      { status: 500 }
    );
  }
}
