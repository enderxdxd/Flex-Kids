import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, enableNetwork, onSnapshotsInSync, collection, getDocs, query, limit, Firestore } from 'firebase/firestore';
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
 * Uses persistentLocalCache so reads can return cached data while the WebSocket
 * connection to the Firestore backend is being established. Without persistence,
 * reads fail immediately with "client is offline" when the SDK hasn't connected yet.
 *
 * persistentSingleTabManager is used WITHOUT forceOwnership so it won't steal
 * the lock from other instances — if the lock is held, it falls back gracefully.
 */
/**
 * @returns true if Firestore backend connection was established, false if offline/timed out.
 */
export async function initFirebase(): Promise<boolean> {
  if (_firebaseReady) return true;

  // Reutiliza app existente se já foi inicializado (evita erro "app already exists")
  _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized:', { projectId: firebaseConfig.projectId });

  // Try persistent cache first (allows reads from IndexedDB while connecting)
  try {
    _db = initializeFirestore(_app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined)
      })
    });
    console.log('✅ Firestore initialized with persistent cache');
  } catch (e) {
    console.warn('⚠️ Persistent cache failed, using default Firestore:', (e as Error).message);
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
  _firebaseReady = true;
  console.log(`✅ Firebase fully initialized (connected: ${connected})`);
  return connected;
}

/**
 * Waits for Firestore to establish its backend connection.
 * Uses a probe read + onSnapshotsInSync to detect when the SDK has connected.
 * Resolves when connected or rejects after timeoutMs.
 */
async function waitForFirestoreConnection(db: Firestore, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Firestore connection not established within ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // onSnapshotsInSync fires when the SDK has caught up with the backend
    const unsubscribe = onSnapshotsInSync(db, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        console.log('✅ Firestore backend connection confirmed (onSnapshotsInSync)');
        resolve();
      }
    });

    // Also trigger a tiny probe read to kick the connection handshake
    getDocs(query(collection(db, '__health__'), limit(1))).catch(() => {
      // Ignore errors — the probe is just to trigger the connection.
      // onSnapshotsInSync will resolve when the SDK connects.
    });
  });
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
