import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (server-side only)
let adminDb: FirebaseFirestore.Firestore;

if (getApps().length === 0) {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
  adminDb = getFirestore(app);
} else {
  adminDb = getFirestore();
}

export { adminDb };

export async function ensureUserDocumentExists(userId: string) {
  const userDoc = adminDb.collection('users').doc(userId);
  const snapshot = await userDoc.get();
  
  if (!snapshot.exists) {
    // Create a new user document with basic information
    const userData = {
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    await userDoc.set(userData);
  } else {
    // Update last login time for existing users
    await userDoc.update({ lastLoginAt: new Date() });
  }
}
