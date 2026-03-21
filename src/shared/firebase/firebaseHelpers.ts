import {
  getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc,
  Query, DocumentReference, CollectionReference, QuerySnapshot, DocumentSnapshot, SetOptions,
} from 'firebase/firestore';

const FIREBASE_TIMEOUT_MS = 15000;
const FIREBASE_WRITE_TIMEOUT_MS = 10000;
const FIREBASE_RETRY_DELAY_MS = 3000;

// Registered by syncService.init() to avoid circular dependency
let _syncService: { markFirebaseSuccess: () => void; markFirebaseFailure: () => void } | null = null;

/** Register syncService reference — called once during init */
export function registerSyncService(svc: { markFirebaseSuccess: () => void; markFirebaseFailure: () => void }): void {
  _syncService = svc;
}

/**
 * Returns true if the error is a known Firebase connectivity issue (timeout or offline).
 * Deliberately narrow — only real network/transport failures, not data errors.
 */
export function isFirebaseConnectivityError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('client is offline') ||
      msg.includes('could not reach') ||
      msg.includes('transport died') ||
      msg.includes('connection failed') ||
      msg.includes('network error') ||
      msg.includes('unavailable')
    );
  }
  return false;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Firebase ${label} timeout`)), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

// ─── READ helpers (with one automatic retry on connectivity errors) ────────────

/**
 * getDocs with timeout + one automatic retry.
 * Only marks Firebase as failed after both attempts fail with a connectivity error.
 */
export async function getDocsSafe<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
  try {
    const result = await withTimeout(getDocs(query), FIREBASE_TIMEOUT_MS, 'getDocs');
    _syncService?.markFirebaseSuccess();
    return result;
  } catch (firstError) {
    if (!isFirebaseConnectivityError(firstError)) throw firstError;

    // One retry after a short pause
    console.warn('[Firebase] getDocs failed, retrying in', FIREBASE_RETRY_DELAY_MS, 'ms...', (firstError as Error).message);
    await new Promise(resolve => setTimeout(resolve, FIREBASE_RETRY_DELAY_MS));

    try {
      const result = await withTimeout(getDocs(query), FIREBASE_TIMEOUT_MS, 'getDocs retry');
      _syncService?.markFirebaseSuccess();
      return result;
    } catch (retryError) {
      if (isFirebaseConnectivityError(retryError)) {
        _syncService?.markFirebaseFailure();
      }
      throw retryError;
    }
  }
}

/**
 * getDoc with timeout + one automatic retry.
 * Only marks Firebase as failed after both attempts fail with a connectivity error.
 */
export async function getDocSafe<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  try {
    const result = await withTimeout(getDoc(ref), FIREBASE_TIMEOUT_MS, 'getDoc');
    _syncService?.markFirebaseSuccess();
    return result;
  } catch (firstError) {
    if (!isFirebaseConnectivityError(firstError)) throw firstError;

    console.warn('[Firebase] getDoc failed, retrying in', FIREBASE_RETRY_DELAY_MS, 'ms...', (firstError as Error).message);
    await new Promise(resolve => setTimeout(resolve, FIREBASE_RETRY_DELAY_MS));

    try {
      const result = await withTimeout(getDoc(ref), FIREBASE_TIMEOUT_MS, 'getDoc retry');
      _syncService?.markFirebaseSuccess();
      return result;
    } catch (retryError) {
      if (isFirebaseConnectivityError(retryError)) {
        _syncService?.markFirebaseFailure();
      }
      throw retryError;
    }
  }
}

// ─── WRITE helpers (no retry — writes must not duplicate) ─────────────────────

/** addDoc with timeout. Marks connectivity failure if it times out. */
export async function addDocSafe(ref: CollectionReference<any>, data: Record<string, any>): Promise<DocumentReference<any>> {
  try {
    const result = await withTimeout(addDoc(ref, data), FIREBASE_WRITE_TIMEOUT_MS, 'addDoc');
    _syncService?.markFirebaseSuccess();
    return result;
  } catch (err) {
    if (isFirebaseConnectivityError(err)) _syncService?.markFirebaseFailure();
    throw err;
  }
}

/** updateDoc with timeout. Marks connectivity failure if it times out. */
export async function updateDocSafe(ref: DocumentReference<any>, data: Record<string, any>): Promise<void> {
  try {
    await withTimeout(updateDoc(ref, data), FIREBASE_WRITE_TIMEOUT_MS, 'updateDoc');
    _syncService?.markFirebaseSuccess();
  } catch (err) {
    if (isFirebaseConnectivityError(err)) _syncService?.markFirebaseFailure();
    throw err;
  }
}

/** setDoc with timeout (optionally with merge options). Marks connectivity failure if it times out. */
export async function setDocSafe(ref: DocumentReference<any>, data: Record<string, any>, options?: SetOptions): Promise<void> {
  try {
    const p = options ? setDoc(ref, data, options) : setDoc(ref, data);
    await withTimeout(p, FIREBASE_WRITE_TIMEOUT_MS, 'setDoc');
    _syncService?.markFirebaseSuccess();
  } catch (err) {
    if (isFirebaseConnectivityError(err)) _syncService?.markFirebaseFailure();
    throw err;
  }
}

/** deleteDoc with timeout. Marks connectivity failure if it times out. */
export async function deleteDocSafe(ref: DocumentReference<any>): Promise<void> {
  try {
    await withTimeout(deleteDoc(ref), FIREBASE_WRITE_TIMEOUT_MS, 'deleteDoc');
    _syncService?.markFirebaseSuccess();
  } catch (err) {
    if (isFirebaseConnectivityError(err)) _syncService?.markFirebaseFailure();
    throw err;
  }
}
