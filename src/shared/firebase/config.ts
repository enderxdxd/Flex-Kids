import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { FIREBASE_CONFIG } from './firebase.env';

// Helper para obter variável de ambiente (suporta Vite e Electron)
const getEnv = (key: string): string | undefined => {
  console.log(`🔍 Getting env var: ${key}`);
  
  // Tenta import.meta.env primeiro (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key];
    console.log(`  ✅ Found in import.meta.env: ${value ? 'YES' : 'NO'}`);
    if (value) return value;
  }
  
  // Fallback para process.env (Electron/Node)
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    console.log(`  ✅ Found in process.env: ${value ? 'YES' : 'NO'}`);
    if (value) return value;
  }
  
  console.log(`  ❌ Not found in any environment`);
  return undefined;
};

// Validar variáveis de ambiente
const apiKey = getEnv('VITE_FIREBASE_API_KEY');
const projectId = getEnv('VITE_FIREBASE_PROJECT_ID');
const authDomain = getEnv('VITE_FIREBASE_AUTH_DOMAIN');

console.log('🔍 Checking environment variables:', {
  hasApiKey: !!apiKey,
  hasProjectId: !!projectId,
  hasAuthDomain: !!authDomain,
  apiKey: apiKey?.substring(0, 10) + '...',
  projectId: projectId,
  environment: typeof import.meta !== 'undefined' ? 'Vite' : 'Node/Electron'
});

// Usar variáveis de ambiente se disponíveis, senão usar configuração hardcoded
const firebaseConfig = {
  apiKey: apiKey || FIREBASE_CONFIG.apiKey,
  authDomain: authDomain || FIREBASE_CONFIG.authDomain,
  databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL') || FIREBASE_CONFIG.databaseURL,
  projectId: projectId || FIREBASE_CONFIG.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || FIREBASE_CONFIG.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || FIREBASE_CONFIG.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || FIREBASE_CONFIG.appId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || FIREBASE_CONFIG.measurementId
};

if (!apiKey || !projectId) {
  console.warn('⚠️ Using hardcoded Firebase config as fallback');
}

// Validar configuração
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is incomplete!', {
    apiKey: firebaseConfig.apiKey ? 'present' : 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING'
  });
  console.warn('⚠️ Continuing without Firebase - app will work in offline mode only');
  // Não lança erro para permitir modo offline
}

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
    try {
      console.log('📊 Initializing Firestore with persistent cache...');
      db = initializeFirestore(getFirebaseApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log('✅ Firestore initialized with offline persistence');
    } catch (e) {
      // initializeFirestore throws if Firestore was already started (e.g. by another import)
      console.warn('⚠️ initializeFirestore failed, falling back to getFirestore:', (e as Error).message);
      db = getFirestore(getFirebaseApp());
    }
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
