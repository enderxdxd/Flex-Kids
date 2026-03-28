import { localDb } from './localDb';
import { getDb, initFirebase } from '../firebase/config';
import { collection, doc, query, where } from 'firebase/firestore';
import { getDocsSafe, addDocSafe, updateDocSafe, setDocSafe, deleteDocSafe, isFirebaseConnectivityError, registerSyncService, markFirebaseWarmedUp } from '../firebase/firebaseHelpers';

const MAX_RETRY_COUNT = 3;

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private onlineListeners: Array<(online: boolean) => void> = [];
  private pendingCountListeners: Array<(count: number) => void> = [];
  private initialized = false;
  private bulkMode = false;
  private _probing = false; // Guard against concurrent probes

  // Real Firebase connectivity tracking
  private _firebaseReachable = true;
  private _lastFirebaseFailure = 0;
  private _firebaseCooldownMs = 5000; // Starts at 5s, doubles on each failure (exponential backoff)
  private _lastFailureEscalation = 0; // Debounce: don't escalate more than once per 2s
  private _firebaseConfirmedOnce = false; // True after the first successful Firebase operation this session

  constructor() {
    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      console.log('Connection restored - attempting sync to confirm Firebase reachability');
      this._firebaseCooldownMs = 5000;
      this._lastFirebaseFailure = 0; // Allow immediate retry
      this._firebaseReachable = true; // Tentatively allow — sync will confirm or deny
      this.notifyListeners(true);

      if (!this._firebaseConfirmedOnce) {
        // Never confirmed Firebase this session — probe immediately instead of waiting 30s
        this.probeFirebaseConnection();
      } else {
        this.syncAll();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost - switching to offline mode');
      this._firebaseReachable = false;
      this.notifyListeners(false);
    });
  }

  /** Call when a Firebase operation succeeds — marks Firebase as reachable and resets backoff */
  markFirebaseSuccess(): void {
    if (!this._firebaseReachable) {
      console.log('🟢 Firebase connection restored');
    }
    this._firebaseReachable = true;
    this._firebaseCooldownMs = 5000; // Reset backoff on success
    if (!this._firebaseConfirmedOnce) {
      this._firebaseConfirmedOnce = true;
      console.log('🟢 Firebase confirmed reachable for this session');
    }
  }

  /** True if Firebase has been confirmed reachable at least once this session */
  isFirebaseReady(): boolean {
    return this._firebaseConfirmedOnce;
  }

  /** Call when a Firebase operation fails with connectivity error — triggers exponential backoff cooldown */
  markFirebaseFailure(): void {
    this._firebaseReachable = false;
    this._lastFirebaseFailure = Date.now();
    // Debounce: only escalate backoff if last escalation was >2s ago (prevents parallel failures from cascading)
    const now = Date.now();
    if (now - this._lastFailureEscalation > 2000) {
      this._firebaseCooldownMs = Math.min(this._firebaseCooldownMs * 2, 30000);
      this._lastFailureEscalation = now;
    }
    console.warn(`[Firebase] Cooldown set to ${this._firebaseCooldownMs / 1000}s after failure`);
  }

  onConnectionChange(callback: (online: boolean) => void): () => void {
    this.onlineListeners.push(callback);
    return () => {
      this.onlineListeners = this.onlineListeners.filter(cb => cb !== callback);
    };
  }

  onPendingCountChange(callback: (count: number) => void): () => void {
    this.pendingCountListeners.push(callback);
    return () => {
      this.pendingCountListeners = this.pendingCountListeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(online: boolean): void {
    this.onlineListeners.forEach(callback => callback(online));
  }

  private async notifyPendingCount(): Promise<void> {
    try {
      const count = await localDb.getPendingSyncCount();
      this.pendingCountListeners.forEach(cb => cb(count));
    } catch {
      // Ignore errors in notification
    }
  }

  isOnline(): boolean {
    // Must have network
    if (!navigator.onLine) return false;

    // Firebase must have been confirmed reachable at least once this session.
    // Without this, the app thinks it's online when only the network is up,
    // fires Firebase queries that timeout, and corrupts the cache with duplicates.
    if (!this._firebaseConfirmedOnce) return false;

    // If Firebase failed recently, respect the cooldown backoff
    if (!this._firebaseReachable) {
      if (Date.now() - this._lastFirebaseFailure > this._firebaseCooldownMs) {
        this._firebaseReachable = true;
        return true;
      }
      return false;
    }
    return true;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Register self with firebaseHelpers for connectivity tracking
      registerSyncService(this);
      
      await localDb.init();

      // Initialize Firebase eagerly BEFORE any service tries to use it.
      // Returns true if the Firestore backend connection was established.
      const connected = await initFirebase();
      markFirebaseWarmedUp(); // Skip 30s cold start timeout — Firebase is already initialized

      // Only mark Firebase as confirmed reachable if the warm-up actually connected.
      // This prevents isOnline() from returning true when Firebase is unreachable,
      // which would cause services to fire queries that timeout and corrupt the cache.
      if (connected) {
        this.markFirebaseSuccess();
        console.log('🟢 Firebase connected during warm-up — online mode active');
      } else {
        console.log('🟠 Firebase did not connect during warm-up — offline mode until connection confirmed');
      }

      this.initialized = true;
      console.log('SyncService initialized successfully');

      // Purge soft-deleted items older than 30 days
      this.purgeSoftDeleted(30).catch(err => 
        console.error('Failed to purge soft-deleted items:', err)
      );

      // Clean up settings items from sync queue (settings no longer use sync queue)
      this.purgeSettingsFromSyncQueue().catch(err =>
        console.error('Failed to purge settings from sync queue:', err)
      );

      // Always start periodic sync — it handles both online sync and offline->online recovery
      this.startPeriodicSync();
      if (this.isOnline()) {
        // Immediate sync to flush any stale queue items
        setTimeout(() => this.syncAll(), 2000);
      }
    } catch (error) {
      console.error('Failed to initialize SyncService:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SyncService not initialized. Call init() first.');
    }
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) return;

    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      if (this.isOnline()) {
        this.syncAll();
      } else if (navigator.onLine && !this._firebaseConfirmedOnce) {
        // Network is up but Firebase hasn't been confirmed yet (warm-up failed).
        // Try a lightweight probe to establish connectivity.
        this.probeFirebaseConnection();
      }
    }, 30000);

    // During cold start, probe aggressively every 5s for up to 60s.
    // Once Firebase is confirmed, stop the aggressive probing.
    if (!this._firebaseConfirmedOnce && navigator.onLine) {
      let coldProbes = 0;
      const coldStartProbe = setInterval(() => {
        coldProbes++;
        if (this._firebaseConfirmedOnce || coldProbes >= 12) {
          clearInterval(coldStartProbe);
          return;
        }
        if (navigator.onLine) {
          this.probeFirebaseConnection();
        }
      }, 5000);
    }
  }

  /**
   * Lightweight probe to check if Firebase is reachable.
   * Called periodically when network is up but Firebase hasn't been confirmed yet.
   */
  private async probeFirebaseConnection(): Promise<void> {
    if (this._probing) return; // Prevent concurrent probes
    this._probing = true;
    try {
      const db = getDb();
      const { getDocs: rawGetDocs, collection: rawCollection, query: rawQuery, limit: rawLimit } = await import('firebase/firestore');
      // Tiny read — just 1 doc from any collection to test the connection
      const probe = rawQuery(rawCollection(db, 'customers'), rawLimit(1));
      const timeoutMs = 10000;
      let timer: ReturnType<typeof setTimeout>;
      await Promise.race([
        rawGetDocs(probe),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('probe timeout')), timeoutMs);
        })
      ]).finally(() => clearTimeout(timer!));
      // If we get here, Firebase is reachable
      this.markFirebaseSuccess();
      console.log('🟢 Firebase probe succeeded — transitioning to online mode');
      this.syncAll();
    } catch (e) {
      console.log('🟠 Firebase probe failed — staying in offline mode');
    } finally {
      this._probing = false;
    }
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Priority order: parents first, then children, then everything else
  private static SYNC_ORDER: Record<string, number> = {
    'customers': 0,
    'children': 1,
    'packages': 2,
    'visits': 3,
    'payments': 4,
    'fiscalNotes': 5,
    'settings': 6,
  };

  /** Enter bulk mode: suspends sync and pending count notifications. Call endBulkMode() when done. */
  startBulkMode(): void {
    console.log('[SYNC] Bulk mode ON — sync and notifications paused');
    this.bulkMode = true;
  }

  /** Exit bulk mode: resumes sync and fires a single pending count update. */
  async endBulkMode(): Promise<void> {
    console.log('[SYNC] Bulk mode OFF — resuming sync');
    this.bulkMode = false;
    await this.notifyPendingCount();
  }

  async syncAll(): Promise<void> {
    if (this.isSyncing || !this.isOnline() || this.bulkMode) {
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync...');

    try {
      const pendingItems = await localDb.getPendingSyncItems();
      console.log(`Found ${pendingItems.length} items to sync`);

      let syncedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // Deduplicate: group by collection+operation+data.id, keep only the latest
      const deduped = new Map<string, typeof pendingItems[0]>();
      for (const item of pendingItems) {
        const dataId = item.data?.id || item.id;
        const key = `${item.collection}:${item.operation}:${dataId}`;
        const existing = deduped.get(key);
        if (!existing || item.timestamp > existing.timestamp) {
          deduped.set(key, item);
        }
      }

      // Mark duplicate entries as synced so they get cleaned up
      const dedupedItems = Array.from(deduped.values());
      const dedupedIds = new Set(dedupedItems.map(i => i.id));
      for (const item of pendingItems) {
        if (!dedupedIds.has(item.id)) {
          await localDb.markAsSynced(item.id);
        }
      }

      // Sort by priority: customers first, then children, then rest
      // This ensures parent IDs are resolved before children reference them
      dedupedItems.sort((a, b) => {
        const orderA = SyncService.SYNC_ORDER[a.collection] ?? 99;
        const orderB = SyncService.SYNC_ORDER[b.collection] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.timestamp - b.timestamp;
      });

      console.log(`Found ${pendingItems.length} items, ${dedupedItems.length} unique after dedup`);
      console.log('Sync order:', dedupedItems.map(i => `${i.collection}:${i.operation}:${i.data?.id?.substring(0, 15)}`));

      for (let i = 0; i < dedupedItems.length; i++) {
        // Re-read item from queue to get updated references (e.g. customerId may have changed)
        const freshItem = await localDb.getSyncQueueItem(dedupedItems[i].id);
        const item = freshItem || dedupedItems[i];

        // Permanently failed items: mark as synced to remove from pending count
        if ((item.retryCount || 0) >= MAX_RETRY_COUNT) {
          console.warn(`⚠️ Removing permanently failed item ${item.id} (${item.collection}/${item.operation}) - exceeded ${MAX_RETRY_COUNT} retries`);
          await localDb.markAsSynced(item.id);
          skippedCount++;
          continue;
        }

        try {
          // Mark as synced BEFORE processing to prevent re-processing by concurrent calls
          await localDb.markAsSynced(item.id);
          await this.syncItem(item);
          syncedCount++;
          console.log(`✅ Synced ${item.operation} on ${item.collection} (${item.data?.id})`);
        } catch (error) {
          // Revert: mark back as pending for retry
          const retryCount = await localDb.incrementRetryCount(item.id);
          failedCount++;
          
          if (isFirebaseConnectivityError(error)) {
            // Firebase offline/timeout — stop trying, will retry next cycle
            console.warn(`[Sync] Firebase unreachable, aborting sync cycle. ${dedupedItems.length - i - 1} items deferred.`);
            break;
          }
          
          console.error(`❌ Failed to sync item ${item.id} (attempt ${retryCount}/${MAX_RETRY_COUNT}):`, error);
          
          if (retryCount >= MAX_RETRY_COUNT) {
            console.error(`🚫 Item ${item.id} permanently failed after ${MAX_RETRY_COUNT} attempts. Collection: ${item.collection}, Op: ${item.operation}`);
          }
        }
      }

      // Garbage collection: remove synced items from queue
      const cleaned = await localDb.cleanupSyncedItems();
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} synced items from queue`);
      }

      console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed, ${skippedCount} skipped`);
      
      // Notify UI of pending count
      await this.notifyPendingCount();
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: any): Promise<void> {
    const db = getDb();
    const collectionRef = collection(db, item.collection);

    switch (item.operation) {
      case 'create': {
        const dataToCreate = { ...item.data };
        delete dataToCreate.id;
        delete dataToCreate.synced;
        // Firestore rejects undefined values — remove them
        Object.keys(dataToCreate).forEach(k => dataToCreate[k] === undefined && delete dataToCreate[k]);
        
        if (item.data.id?.startsWith('local_')) {
          const oldLocalId = item.data.id;

          // DEDUP: Check if this local item was already synced by a previous run
          let existingFirebaseId: string | null = null;
          try {
            if (dataToCreate.name && dataToCreate.createdAt) {
              // Collections with 'name' field: dedup by name + createdAt within 5s
              const createdAtValue = dataToCreate.createdAt;
              const q = query(collectionRef, where('name', '==', dataToCreate.name));
              const snapshot = await getDocsSafe(q);
              for (const docSnap of snapshot.docs) {
                const docData = docSnap.data();
                const docCreatedAt = docData.createdAt?.toDate?.() || docData.createdAt;
                const localCreatedAt = createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue);
                if (docCreatedAt && localCreatedAt) {
                  const docTime = docCreatedAt instanceof Date ? docCreatedAt.getTime() : new Date(docCreatedAt).getTime();
                  const localTime = localCreatedAt.getTime();
                  if (Math.abs(docTime - localTime) < 5000) {
                    existingFirebaseId = docSnap.id;
                    console.log(`🔄 Found existing Firebase doc for ${oldLocalId} → ${existingFirebaseId} (dedup by name)`);
                    break;
                  }
                }
              }
            } else if (item.collection === 'visits' && dataToCreate.childId && dataToCreate.checkIn) {
              // Visits: dedup by childId + checkIn within 60s
              const q = query(collectionRef,
                where('childId', '==', dataToCreate.childId),
                where('unitId', '==', dataToCreate.unitId || ''),
                where('checkOut', '==', null)
              );
              const snapshot = await getDocsSafe(q);
              const localCheckIn = dataToCreate.checkIn instanceof Date ? dataToCreate.checkIn : new Date(dataToCreate.checkIn);
              for (const docSnap of snapshot.docs) {
                const docData = docSnap.data();
                const docCheckIn = docData.checkIn?.toDate?.() || docData.checkIn;
                if (docCheckIn && localCheckIn) {
                  const docTime = docCheckIn instanceof Date ? docCheckIn.getTime() : new Date(docCheckIn).getTime();
                  const localTime = localCheckIn.getTime();
                  if (Math.abs(docTime - localTime) < 60000) {
                    existingFirebaseId = docSnap.id;
                    console.log(`🔄 Found existing Firebase visit for ${oldLocalId} → ${existingFirebaseId} (dedup by childId+checkIn)`);
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Dedup check failed, will create new:', e);
          }

          let newFirebaseId: string;
          if (existingFirebaseId) {
            // Already exists in Firebase, just use the existing ID
            newFirebaseId = existingFirebaseId;
          } else {
            // Create new document in Firebase
            const docRef = await addDocSafe(collectionRef, dataToCreate);
            newFirebaseId = docRef.id;
          }
          
          // Update local record with Firebase ID
          await localDb.delete(item.collection as any, oldLocalId).catch(() => {});
          await localDb.upsert(item.collection as any, { ...item.data, id: newFirebaseId, synced: true });

          // Update all references (customerId, childId) in other stores and sync queue
          const refsUpdated = await localDb.updateReferences(oldLocalId, newFirebaseId);
          if (refsUpdated > 0) {
            console.log(`🔗 Updated ${refsUpdated} local references from ${oldLocalId} → ${newFirebaseId}`);
          }

          // Also fix any documents already in Firebase that have the old local_ ID as a reference
          await this.fixFirebaseReferences(oldLocalId, newFirebaseId);
        } else {
          // Already has Firebase ID — use setDoc (merge) to avoid error if already exists
          try {
            await setDocSafe(doc(db, item.collection, item.data.id), dataToCreate, { merge: true });
          } catch {
            // If it fails, just mark as synced locally
          }
          await localDb.markItemAsSynced(item.collection as any, item.data.id);
        }
        break;
      }

      case 'update': {
        if (!item.data.id?.startsWith('local_')) {
          const dataToUpdate = { ...item.data };
          delete dataToUpdate.id;
          delete dataToUpdate.synced;
          // Firestore rejects undefined values — remove them
          Object.keys(dataToUpdate).forEach(k => dataToUpdate[k] === undefined && delete dataToUpdate[k]);
          try {
            await setDocSafe(doc(db, item.collection, item.data.id), dataToUpdate, { merge: true });
          } catch {
            // If setDoc fails, just mark as synced to avoid infinite loop
          }
          await localDb.markItemAsSynced(item.collection as any, item.data.id);
        }
        break;
      }

      case 'delete': {
        if (item.data.id && !item.data.id.startsWith('local_')) {
          try {
            const docToDelete = doc(db, item.collection, item.data.id);
            await deleteDocSafe(docToDelete);
          } catch {
            // Doc may already be deleted — not an error
          }
        }
        if (item.data.id) {
          await localDb.delete(item.collection as any, item.data.id).catch(() => {});
        }
        break;
      }
    }
  }

  private async fixFirebaseReferences(oldLocalId: string, newFirebaseId: string): Promise<void> {
    try {
      const db = getDb();
      // Collections and fields that might reference the old local_ ID
      const refCollections: Array<{ collectionName: string; field: string }> = [
        { collectionName: 'children', field: 'customerId' },
        { collectionName: 'packages', field: 'customerId' },
        { collectionName: 'payments', field: 'customerId' },
        { collectionName: 'visits', field: 'childId' },
        { collectionName: 'payments', field: 'childId' },
        { collectionName: 'packages', field: 'childId' },
      ];

      for (const { collectionName, field } of refCollections) {
        try {
          const q = query(collection(db, collectionName), where(field, '==', oldLocalId));
          const snapshot = await getDocsSafe(q);
          for (const docSnap of snapshot.docs) {
            await updateDocSafe(doc(db, collectionName, docSnap.id), { [field]: newFirebaseId });
            console.log(`🔗 Fixed Firebase ref: ${collectionName}/${docSnap.id}.${field} → ${newFirebaseId}`);
          }
        } catch {
          // Collection may not exist or query may fail - non-critical
        }
      }
    } catch (error) {
      console.warn('fixFirebaseReferences failed (non-critical):', error);
    }
  }

  async saveLocally(
    collection: string,
    operation: 'create' | 'update',
    data: any
  ): Promise<string> {
    this.ensureInitialized();
    
    const id = data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemWithId = { ...data, id, synced: 0 };

    if (operation === 'create') {
      await localDb.upsert(collection as any, itemWithId);
    } else {
      await localDb.update(collection as any, id, itemWithId);
    }

    await localDb.addToSyncQueue(collection, operation, itemWithId);

    // Notify UI of new pending item
    await this.notifyPendingCount();

    return id;
  }

  async deleteLocally(
    collectionName: string,
    id: string
  ): Promise<void> {
    this.ensureInitialized();
    
    await localDb.delete(collectionName as any, id).catch(() => {});
    await localDb.addToSyncQueue(collectionName, 'delete', { id });

    // Notify UI
    await this.notifyPendingCount();
  }

  async saveToCacheOnly(
    collectionName: string,
    data: any
  ): Promise<void> {
    this.ensureInitialized();
    const id = data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await localDb.upsert(collectionName as any, { ...data, id, synced: true });
    // Skip notification during bulk imports to avoid hundreds of UI updates
    if (!this.bulkMode) {
      await this.notifyPendingCount();
    }
  }

  async getFromLocal(collection: string, id: string): Promise<any> {
    this.ensureInitialized();
    return await localDb.get(collection as any, id);
  }

  async getAllFromLocal(collection: string, includeDeleted = false): Promise<any[]> {
    this.ensureInitialized();
    const items = await localDb.getAll(collection as any);
    if (includeDeleted) return items;
    return items.filter((item: any) => !item.deletedAt);
  }

  async getAllFromLocalByUnit(collection: string, unitId: string, includeDeleted = false): Promise<any[]> {
    this.ensureInitialized();
    const items = await localDb.getAllByIndex(collection as any, 'by-unit', unitId);
    if (includeDeleted) return items;
    return items.filter((item: any) => !item.deletedAt);
  }

  async bulkSaveToCacheOnly(collectionName: string, items: any[]): Promise<void> {
    this.ensureInitialized();
    const prepared = items.map(data => ({
      ...data,
      id: data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      synced: true,
    }));
    await localDb.bulkUpsert(collectionName as any, prepared);
    if (!this.bulkMode) {
      await this.notifyPendingCount();
    }
  }

  async getAllByIndex(collection: string, indexName: string, query?: any): Promise<any[]> {
    return await localDb.getAllByIndex(collection as any, indexName, query);
  }

  async getPendingSyncCount(): Promise<number> {
    try {
      return await localDb.getPendingSyncCount();
    } catch {
      return 0;
    }
  }

  async exportBackup(): Promise<string> {
    const data = await localDb.exportBackup();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Permanently removes soft-deleted items older than retentionDays (default 30).
   * Returns the number of items purged.
   */
  async purgeSoftDeleted(retentionDays = 30): Promise<number> {
    this.ensureInitialized();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    let purged = 0;

    const stores = ['customers', 'children', 'packages', 'payments', 'visits'] as const;
    for (const store of stores) {
      try {
        const items = await localDb.getAll(store as any);
        for (const item of items) {
          if (item.deletedAt) {
            const deletedDate = item.deletedAt instanceof Date ? item.deletedAt : new Date(item.deletedAt);
            if (deletedDate < cutoff) {
              await localDb.delete(store as any, item.id);
              purged++;
            }
          }
        }
      } catch {
        // Store may not exist
      }
    }

    if (purged > 0) {
      console.log(`🗑️ Purged ${purged} soft-deleted items older than ${retentionDays} days`);
    }
    return purged;
  }

  /**
   * Remove all 'settings' items from the sync queue.
   * Settings are now saved directly to Firebase (fire-and-forget) and don't need the queue.
   */
  private async purgeSettingsFromSyncQueue(): Promise<number> {
    try {
      const pendingItems = await localDb.getPendingSyncItems();
      let purged = 0;
      for (const item of pendingItems) {
        if (item.collection === 'settings') {
          await localDb.markAsSynced(item.id);
          purged++;
        }
      }
      if (purged > 0) {
        console.log(`🧹 Purged ${purged} settings items from sync queue`);
        await localDb.cleanupSyncedItems();
        await this.notifyPendingCount();
      }
      return purged;
    } catch (error) {
      console.error('Failed to purge settings from sync queue:', error);
      return 0;
    }
  }

  /** Clears only the pending sync queue (does NOT clear cached data stores). */
  async clearLocalData(): Promise<void> {
    await localDb.clearSyncQueue();
  }

  destroy(): void {
    this.stopPeriodicSync();
    this.onlineListeners = [];
    this.pendingCountListeners = [];
  }
}

export const syncService = new SyncService();
