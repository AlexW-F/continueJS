import { NextRequest, NextResponse } from 'next/server';
import { validateAPIAccess, addCORSHeaders, rateLimit, getRateLimitIdentifier, addRateLimitHeaders, RATE_LIMITS } from './src/lib/api-security';

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

    // Apply rate limiting (skip in development if needed)
    if (process.env.NODE_ENV !== 'development' || process.env.ENFORCE_RATE_LIMIT === 'true') {
      const identifier = getRateLimitIdentifier(request);
      const pathname = request.nextUrl.pathname;
      
      // Determine which rate limit config to use
      let config = RATE_LIMITS.media;
      if (pathname.startsWith('/api/search')) {
        config = RATE_LIMITS.search;
      }
      
      const rateLimitResult = rateLimit(identifier, config);
      
      if (!rateLimitResult.allowed) {
        const response = NextResponse.json(
          { 
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
          },
          { status: 429 }
        );
        
        response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());
        addRateLimitHeaders(response, rateLimitResult, config);
        return addCORSHeaders(request, response);
      }
      
      // Continue with request and add CORS + rate limit headers
      const response = NextResponse.next();
      addRateLimitHeaders(response, rateLimitResult, config);
      return addCORSHeaders(request, response);
    }

    // Continue with request and add CORS headers (dev mode without rate limiting)
    const response = NextResponse.next();
    return addCORSHeaders(request, response);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
