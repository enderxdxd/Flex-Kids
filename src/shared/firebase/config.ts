import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { FIREBASE_CONFIG } from './firebase.env';

// Helper para obter variável de ambiente (suporta Vite e Electron)
const getEnv = (key: string): string | undefined => {
  // Tenta import.meta.env primeiro (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key];
    if (value) return value;
  }
  
  // Fallback para process.env (Electron/Node)
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value) return value;
  }
  
  return undefined;
};

// Validar variáveis de ambiente
const apiKey = getEnv('VITE_FIREBASE_API_KEY');
const projectId = getEnv('VITE_FIREBASE_PROJECT_ID');
const authDomain = getEnv('VITE_FIREBASE_AUTH_DOMAIN');

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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is incomplete!', {
    apiKey: firebaseConfig.apiKey ? 'present' : 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING'
  });
  console.warn('⚠️ Continuing without Firebase - app will work in offline mode only');
}

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _analytics: Analytics | null = null;
let _firebaseReady = false;

/**
 * Inicializa Firebase eagerly. Deve ser chamado UMA VEZ no bootstrap (syncService.init).
 * Idempotente — chamadas repetidas são ignoradas.
 *
 * Uses memoryLocalCache instead of persistent cache to avoid IndexedDB lock conflicts
 * that cause "client is offline" errors in Electron. The app has its own offline cache
 * system (localDb/IndexedDB + syncService) so Firestore persistence is not needed.
 */
export async function initFirebase(): Promise<void> {
  if (_firebaseReady) return;

  // Reutiliza app existente se já foi inicializado (evita erro "app already exists")
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized:', { projectId: firebaseConfig.projectId });

  try {
    _db = initializeFirestore(_app, {
      localCache: memoryLocalCache()
    });
    console.log('✅ Firestore initialized with memory cache (no IndexedDB lock)');
  } catch (e) {
    // initializeFirestore throws if Firestore was already started (e.g. by another import)
    console.warn('⚠️ initializeFirestore failed, falling back to getFirestore:', (e as Error).message);
    _db = getFirestore(_app);
  }

  _auth = getAuth(_app);
  _firebaseReady = true;
  console.log('✅ Firebase fully initialized');
}

export const getFirebaseApp = (): FirebaseApp => {
  if (!_app) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return _app;
};

export const getDb = (): Firestore => {
  if (!_db) throw new Error('Firestore not initialized. Call initFirebase() first.');
  return _db;
};

export const getFirebaseAuth = (): Auth => {
  if (!_auth) throw new Error('Auth not initialized. Call initFirebase() first.');
  return _auth;
};

export const getFirebaseAnalytics = (): Analytics => {
  if (!_analytics && typeof window !== 'undefined' && _app) {
    _analytics = getAnalytics(_app);
  }
  if (!_analytics) throw new Error('Analytics not available.');
  return _analytics;
};

export const isFirebaseReady = (): boolean => _firebaseReady;
