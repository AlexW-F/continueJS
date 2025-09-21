// Test script to add sample data to Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addTestData() {
  try {
    // Add a test document with a fake user ID
    const testDoc = {
      userId: 'test-user-123', // We'll use this to test our queries
      title: 'Test Movie',
      type: 'movie',
      status: 'want-to-watch',
      genre: 'Action',
      year: 2024,
      rating: null,
      notes: 'This is a test movie entry',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'media-items'), testDoc);
    console.log('✅ Test document added with ID:', docRef.id);
    
    // Add another one for a different user
    const testDoc2 = {
      userId: 'different-user-456',
      title: 'Another Test Movie',
      type: 'movie',
      status: 'watched',
      genre: 'Comedy',
      year: 2023,
      rating: 8,
      notes: 'This belongs to a different user',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef2 = await addDoc(collection(db, 'media-items'), testDoc2);
    console.log('✅ Second test document added with ID:', docRef2.id);
    
    console.log('🎉 Test data added successfully!');
  } catch (error) {
    console.error('❌ Error adding test data:', error);
  }
}

addTestData();
