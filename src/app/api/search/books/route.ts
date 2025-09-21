import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthResponse } from '@/lib/auth-middleware';
import { BookSearchResult } from '@/lib/types';

// GET /api/search/books - Search for books using Google Books API
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

  const googleBooksApiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
  if (!googleBooksApiKey) {
    return NextResponse.json(
      { success: false, error: 'Google Books API key not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${googleBooksApiKey}&maxResults=10`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data.items as BookSearchResult[],
    });
  } catch (error) {
    console.error('Error searching books:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search books' },
      { status: 500 }
    );
  }
}
