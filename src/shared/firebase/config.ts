import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, Firestore } from 'firebase/firestore';
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

const PERSISTENCE_RETRY_ATTEMPTS = 3;
const PERSISTENCE_RETRY_DELAY_MS = 500;

/**
 * Inicializa Firebase eagerly. Deve ser chamado UMA VEZ no bootstrap (syncService.init).
 * Idempotente — chamadas repetidas são ignoradas.
 * Retries persistentSingleTabManager lock up to 3 times with 500ms delay.
 */
export async function initFirebase(): Promise<void> {
  if (_firebaseReady) return;

  // Reutiliza app existente se já foi inicializado (evita erro "app already exists")
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized:', { projectId: firebaseConfig.projectId });

  // Tenta com persistência, aguarda até que o lock do IndexedDB seja liberado
  let attempt = 0;
  let persistenceOk = false;
  while (attempt < PERSISTENCE_RETRY_ATTEMPTS) {
    try {
      _db = initializeFirestore(_app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({ forceOwnership: true })
        })
      });
      persistenceOk = true;
      console.log('✅ Firestore initialized with offline persistence');
      break;
    } catch (e) {
      attempt++;
      const msg = (e as Error).message;
      if (attempt >= PERSISTENCE_RETRY_ATTEMPTS) {
        console.warn(`⚠️ Persistence failed after ${PERSISTENCE_RETRY_ATTEMPTS} attempts, using mode without cache:`, msg);
        _db = getFirestore(_app);
      } else {
        console.warn(`⚠️ Firestore persistence attempt ${attempt} failed, retrying in ${PERSISTENCE_RETRY_DELAY_MS}ms:`, msg);
        await new Promise(r => setTimeout(r, PERSISTENCE_RETRY_DELAY_MS));
      }
    }
  }

  _auth = getAuth(_app);
  _firebaseReady = true;
  console.log(`✅ Firebase fully initialized (persistence: ${persistenceOk ? 'ON' : 'OFF'})`);
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
