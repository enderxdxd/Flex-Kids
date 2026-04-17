import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, enableNetwork, collection, query, limit, Firestore, getDocsFromServer } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions as _getFunctions, Functions } from 'firebase/functions';
import { getAnalytics, Analytics } from 'firebase/analytics';
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

// Fallback hardcoded — usado quando variáveis de ambiente não estão definidas (ex: dev local, Electron)
// Em produção (Vercel), as variáveis VITE_FIREBASE_* devem estar configuradas no painel.
const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyApYMDae0KxgM8TGd4FrKqE82rv1GPtCkE',
  authDomain: 'mobius-74bec.firebaseapp.com',
  databaseURL: 'https://mobius-74bec-default-rtdb.firebaseio.com',
  projectId: 'mobius-74bec',
  storageBucket: 'mobius-74bec.firebasestorage.app',
  messagingSenderId: '710658322047',
  appId: '1:710658322047:web:ba0ad2e0b925fc5c5ad94a',
  measurementId: 'G-TWMN41GGEZ',
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || FALLBACK_CONFIG.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || FALLBACK_CONFIG.authDomain,
  databaseURL: getEnv('VITE_FIREBASE_DATABASE_URL') || FALLBACK_CONFIG.databaseURL,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || FALLBACK_CONFIG.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || FALLBACK_CONFIG.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || FALLBACK_CONFIG.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || FALLBACK_CONFIG.appId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || FALLBACK_CONFIG.measurementId,
};

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
let _functions: Functions | null = null;
let _firebaseReady = false;

/**
 * Inicializa Firebase eagerly. Deve ser chamado UMA VEZ no bootstrap (syncService.init).
 * Idempotente — chamadas repetidas são ignoradas.
 *
 * @returns true if Firestore backend connection was established, false if offline/timed out.
 */
export async function initFirebase(): Promise<boolean> {
  if (_firebaseReady) return true;

  // Reutiliza app existente se já foi inicializado (evita erro "app already exists")
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized:', { projectId: firebaseConfig.projectId });

  // Use persistentLocalCache with persistentMultipleTabManager.
  // - Persistent cache allows reads to be served from IndexedDB immediately while
  //   the WebSocket to Firestore backend connects in background.
  // - MultipleTabManager supports multiple instances (multiple PCs / Electron windows)
  //   without IndexedDB lock conflicts — unlike SingleTabManager.
  // - Without persistent cache, every app open requires a full download from backend,
  //   and if the WebSocket is slow, ALL queries timeout.
  try {
    _db = initializeFirestore(_app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    console.log('✅ Firestore initialized with persistent cache (MultipleTabManager)');
  } catch (e) {
    // If persistent cache fails (e.g. IndexedDB unavailable), fall back to default
    console.warn('⚠️ initializeFirestore with persistent cache failed, using default Firestore:', (e as Error).message);
    _db = getFirestore(_app);
  }

  // Force the SDK to start its network connection and wait for it to be established.
  // Without this, the prefetch fires 7+ parallel queries before the WebSocket is ready,
  // causing cascading timeouts and "client is offline" errors.
  let connected = false;
  try {
    await enableNetwork(_db);
    console.log('✅ Firestore network enabled, waiting for backend connection...');
    await waitForFirestoreConnection(_db, 15000);
    connected = true;
  } catch (e) {
    console.warn('⚠️ Firestore warm-up did not complete (app will work from cache):', (e as Error).message);
  }

  _auth = getAuth(_app);
  _functions = _getFunctions(_app);
  _firebaseReady = true;
  console.log(`✅ Firebase fully initialized (connected: ${connected})`);
  return connected;
}

/**
 * Waits for Firestore to establish its backend connection.
 * Uses a real server read so we don't mistake a cache-only sync for
 * backend connectivity during cold start.
 */
async function waitForFirestoreConnection(db: Firestore, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      getDocsFromServer(query(collection(db, 'customers'), limit(1)))
        .catch((err: any) => {
          // permission-denied means the server IS reachable — it responded with a denial.
          // This counts as a successful connectivity check.
          if (err?.code === 'permission-denied') {
            console.log('✅ Firestore backend reachable (permission-denied before auth — expected)');
            return;
          }
          throw err;
        }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Firestore connection not established within ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
    console.log('✅ Firestore backend connection confirmed (server probe)');
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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

export const getFirebaseFunctions = (): Functions => {
  if (!_functions) throw new Error('Functions not initialized. Call initFirebase() first.');
  return _functions;
};

export const getFirebaseAnalytics = (): Analytics => {
  if (!_analytics && typeof window !== 'undefined' && _app) {
    _analytics = getAnalytics(_app);
  }
  if (!_analytics) throw new Error('Analytics not available.');
  return _analytics;
};

export const isFirebaseReady = (): boolean => _firebaseReady;
