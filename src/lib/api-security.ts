import { NextRequest, NextResponse } from 'next/server';

/**
 * API Security Configuration
 * Validates allowed domains and rate limits for API routes
 */

// Allowed domains (origins) that can access the API
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];

/**
 * Validates if the request comes from an allowed origin (domain)
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || request.headers.get('referer');
  
  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // No origin header (direct API calls, not from browser)
  if (!origin) {
    console.warn('⚠️  Request without origin header');
    return false;
  }

  // Check if origin is in allowed list
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    // Remove trailing slashes for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedAllowed = allowed.replace(/\/$/, '');
    return normalizedOrigin === normalizedAllowed || normalizedOrigin.startsWith(normalizedAllowed);
  });

  if (!isAllowed) {
    console.error(`❌ Access denied from origin: ${origin}`);
  }

  return isAllowed;
}

/**
 * Validates API access with origin checking
 * Returns null if valid, or NextResponse with error if invalid
 */
export function validateAPIAccess(request: NextRequest): NextResponse | null {
  // Validate origin
  if (!validateOrigin(request)) {
    const origin = request.headers.get('origin') || 'unknown';
    
    return NextResponse.json(
      { error: 'Access denied: Origin not allowed' },
      { 
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '', // No CORS for denied requests
        }
      }
    );
  }

  // All checks passed - add CORS headers
  return null;
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  
  return response;
}

/**
 * Get identifier for rate limiting (IP or user-specific)
 */
export function getRateLimitIdentifier(request: NextRequest): string {
  // Try to get user ID from Authorization header (if Firebase token)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Use a hash of the auth token as identifier
    return `auth:${authHeader.substring(0, 20)}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIP || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// Rate limit configs for different endpoint types
export const RATE_LIMITS = {
  // Search endpoints - more generous (external API calls)
  search: { windowMs: 60000, maxRequests: 30 }, // 30 per minute
  
  // Media CRUD - normal usage
  media: { windowMs: 60000, maxRequests: 100 }, // 100 per minute
  
  // Strict limit for auth/sensitive operations
  strict: { windowMs: 60000, maxRequests: 20 }, // 20 per minute
};

// Simple in-memory rate limiter (for production use Redis/Vercel KV)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.media
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    // Create new record
    const newRecord = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newRecord);
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1,
      resetTime: newRecord.resetTime
    };
  }

  if (record.count >= config.maxRequests) {
    return { 
      allowed: false, 
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  record.count++;
  return { 
    allowed: true, 
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: { remaining: number; resetTime: number },
  config: RateLimitConfig
): NextResponse {
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  return response;
}

/**
 * Clean up old rate limit records
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute
