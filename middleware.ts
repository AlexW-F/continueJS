import { NextRequest, NextResponse } from 'next/server';
import { validateAPIAccess, addCORSHeaders } from './src/lib/api-security';

export function middleware(request: NextRequest) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return addCORSHeaders(request, response);
  }

  // Only apply security to API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Validate API access (domain allowlist)
    const validationError = validateAPIAccess(request);
    
    if (validationError) {
      return validationError;
    }

    // Continue with request and add CORS headers
    const response = NextResponse.next();
    return addCORSHeaders(request, response);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
