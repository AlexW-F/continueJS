import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { AnimeSearchResult } from '@/lib/types';

// GET /api/search/anime - Search for anime using Jikan API
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

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Jikan API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data.data as AnimeSearchResult[],
    });
  } catch (error) {
    console.error('Error searching anime:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search anime' },
      { status: 500 }
    );
  }
}
