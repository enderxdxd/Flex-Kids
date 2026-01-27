import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let analytics: Analytics;

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    console.log('🔥 Initializing Firebase with config:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      hasApiKey: !!firebaseConfig.apiKey
    });
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
  }
  return app;
};

export const getDb = (): Firestore => {
  if (!db) {
    console.log('📊 Initializing Firestore...');
    db = getFirestore(getFirebaseApp());
    console.log('✅ Firestore initialized');
  }
  return db;
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
};

export const getFirebaseAnalytics = (): Analytics => {
  if (!analytics && typeof window !== 'undefined') {
    analytics = getAnalytics(getFirebaseApp());
  }
  return analytics;
};
