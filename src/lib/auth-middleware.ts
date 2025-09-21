import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

export async function authenticateRequest(request: NextRequest): Promise<{
  success: boolean;
  userId?: string;
  user?: { uid: string; email?: string; name?: string };
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' };
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const decodedToken = await verifyIdToken(idToken);
    
    return {
      success: true,
      userId: decodedToken.uid,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Invalid token' };
  }
}

export function createAuthResponse(error: string, status: number = 401) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}
