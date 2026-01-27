import { localDb } from './localDb';
import { getDb } from '../firebase/config';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private onlineListeners: Array<(online: boolean) => void> = [];
  private initialized = false;

  constructor() {
    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      console.log('Connection restored - starting sync');
      this.notifyListeners(true);
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost - switching to offline mode');
      this.notifyListeners(false);
    });
  }

  onConnectionChange(callback: (online: boolean) => void): () => void {
    this.onlineListeners.push(callback);
    return () => {
      this.onlineListeners = this.onlineListeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(online: boolean): void {
    this.onlineListeners.forEach(callback => callback(online));
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await localDb.init();
      this.initialized = true;
      console.log('SyncService initialized successfully');
      
      // Start periodic sync if online
      if (this.isOnline()) {
        this.startPeriodicSync();
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
    
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline()) {
        this.syncAll();
      }
    }, 30000);
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncAll(): Promise<void> {
    if (this.isSyncing || !this.isOnline()) {
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync...');

    try {
      const pendingItems = await localDb.getPendingSyncItems();
      console.log(`Found ${pendingItems.length} items to sync`);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await localDb.markAsSynced(item.id);
          console.log(`Synced ${item.operation} on ${item.collection}`);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          // Continue with next item even if one fails
        }
      }

      console.log('Sync completed');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: any): Promise<void> {
    const db = getDb();
    const collectionRef = collection(db, item.collection);

    switch (item.operation) {
      case 'create':
        // Remove local ID prefix if exists
        const dataToCreate = { ...item.data };
        if (dataToCreate.id?.startsWith('local_')) {
          delete dataToCreate.id;
        }
        
        const docRef = await addDoc(collectionRef, dataToCreate);
        
        // Update local record with Firebase ID
        if (item.data.id?.startsWith('local_')) {
          await localDb.delete(item.collection as any, item.data.id);
          await localDb.add(item.collection as any, { ...item.data, id: docRef.id, synced: true });
        }
        break;

      case 'update':
        if (!item.data.id?.startsWith('local_')) {
          const docToUpdate = doc(db, item.collection, item.data.id);
          await updateDoc(docToUpdate, item.data);
          await localDb.markItemAsSynced(item.collection as any, item.data.id);
        }
        break;

      case 'delete':
        // Handle delete if needed
        break;
    }
  }

  async saveLocally(
    collection: string,
    operation: 'create' | 'update',
    data: any
  ): Promise<string> {
    this.ensureInitialized();
    
    const id = data.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const itemWithId = { ...data, id, synced: false };

    if (operation === 'create') {
      await localDb.add(collection as any, itemWithId);
    } else {
      await localDb.update(collection as any, id, itemWithId);
    }

    await localDb.addToSyncQueue(collection, operation, itemWithId);

    // Try to sync immediately if online
    if (this.isOnline()) {
      setTimeout(() => this.syncAll(), 100);
    }

    return id;
  }

  async getFromLocal(collection: string, id: string): Promise<any> {
    this.ensureInitialized();
    return await localDb.get(collection as any, id);
  }

  async getAllFromLocal(collection: string): Promise<any[]> {
    this.ensureInitialized();
    return await localDb.getAll(collection as any);
  }

  async getAllByIndex(collection: string, indexName: string, query?: any): Promise<any[]> {
    return await localDb.getAllByIndex(collection as any, indexName, query);
  }

  async clearLocalData(): Promise<void> {
    await localDb.clearSyncQueue();
  }

  destroy(): void {
    this.stopPeriodicSync();
    this.onlineListeners = [];
  }
}

export const syncService = new SyncService();
