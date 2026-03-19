import { getDocs, getDoc, Query, DocumentReference, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';

const FIREBASE_TIMEOUT_MS = 15000;

// Registered by syncService.init() to avoid circular dependency
let _syncService: { markFirebaseSuccess: () => void; markFirebaseFailure: () => void } | null = null;

/** Register syncService reference — called once during init */
export function registerSyncService(svc: { markFirebaseSuccess: () => void; markFirebaseFailure: () => void }): void {
  _syncService = svc;
}

/**
 * Returns true if the error is a known Firebase connectivity issue (timeout or offline).
 * Useful for deciding whether to log as warn vs error.
 */
export function isFirebaseConnectivityError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('offline') || msg.includes('unavailable') || msg.includes('failed to get document');
  }
  return false;
}

/**
 * getDocs with timeout protection — prevents hanging when Firebase is offline or slow to connect.
 * Automatically tracks Firebase connectivity state.
 */
export async function getDocsSafe<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
  const firebasePromise = getDocs(query);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firebase getDocs timeout')), FIREBASE_TIMEOUT_MS)
  );
  try {
    const result = await Promise.race([firebasePromise, timeoutPromise]);
    _syncService?.markFirebaseSuccess();
    return result;
  } catch (error) {
    if (isFirebaseConnectivityError(error)) {
      _syncService?.markFirebaseFailure();
    }
    throw error;
  }
}

/**
 * getDoc with timeout protection — prevents hanging when Firebase is offline or slow to connect.
 * Automatically tracks Firebase connectivity state.
 */
export async function getDocSafe<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const firebasePromise = getDoc(ref);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firebase getDoc timeout')), FIREBASE_TIMEOUT_MS)
  );
  try {
    const result = await Promise.race([firebasePromise, timeoutPromise]);
    _syncService?.markFirebaseSuccess();
    return result;
  } catch (error) {
    if (isFirebaseConnectivityError(error)) {
      _syncService?.markFirebaseFailure();
    }
    throw error;
  }
}
