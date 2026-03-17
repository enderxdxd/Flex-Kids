import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FlexKidsDB extends DBSchema {
  visits: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-unit': string };
  };
  customers: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-unit': string };
  };
  children: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-customer': string; 'by-unit': string };
  };
  payments: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-date': number; 'by-unit': string };
  };
  packages: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-customer': string; 'by-unit': string };
  };
  kidsPlans: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-unit': string; 'by-child': string };
  };
  settings: {
    key: string;
    value: any;
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      collection: string;
      operation: 'create' | 'update' | 'delete';
      data: any;
      timestamp: number;
      synced: number;
      retryCount?: number;
    };
    indexes: { 'by-synced': number };
  };
}

class LocalDatabase {
  private db: IDBPDatabase<FlexKidsDB> | null = null;
  private readonly DB_NAME = 'flex-kids-db';
  private readonly DB_VERSION = 4;
  private ghostMigrationDone = false;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<FlexKidsDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Visits store
        if (!db.objectStoreNames.contains('visits')) {
          const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
          visitStore.createIndex('by-sync', 'synced');
          visitStore.createIndex('by-unit', 'unitId');
        }

        // Customers store
        if (!db.objectStoreNames.contains('customers')) {
          const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
          customerStore.createIndex('by-sync', 'synced');
          customerStore.createIndex('by-unit', 'unitId');
        } else if (oldVersion < 3) {
          const customerStore = transaction.objectStore('customers');
          if (!customerStore.indexNames.contains('by-unit')) {
            customerStore.createIndex('by-unit', 'unitId');
          }
        }

        // Children store
        if (!db.objectStoreNames.contains('children')) {
          const childrenStore = db.createObjectStore('children', { keyPath: 'id' });
          childrenStore.createIndex('by-sync', 'synced');
          childrenStore.createIndex('by-customer', 'customerId');
          childrenStore.createIndex('by-unit', 'unitId');
        } else if (oldVersion < 3) {
          const childrenStore = transaction.objectStore('children');
          if (!childrenStore.indexNames.contains('by-unit')) {
            childrenStore.createIndex('by-unit', 'unitId');
          }
        }

        // Payments store
        if (!db.objectStoreNames.contains('payments')) {
          const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentStore.createIndex('by-sync', 'synced');
          paymentStore.createIndex('by-date', 'date');
          paymentStore.createIndex('by-unit', 'unitId');
        } else if (oldVersion < 3) {
          const paymentStore = transaction.objectStore('payments');
          if (!paymentStore.indexNames.contains('by-unit')) {
            paymentStore.createIndex('by-unit', 'unitId');
          }
        }

        // Packages store
        if (!db.objectStoreNames.contains('packages')) {
          const packageStore = db.createObjectStore('packages', { keyPath: 'id' });
          packageStore.createIndex('by-sync', 'synced');
          packageStore.createIndex('by-customer', 'customerId');
          packageStore.createIndex('by-unit', 'unitId');
        } else if (oldVersion < 3) {
          const packageStore = transaction.objectStore('packages');
          if (!packageStore.indexNames.contains('by-unit')) {
            packageStore.createIndex('by-unit', 'unitId');
          }
        }

        // Kids Plans store
        if (!db.objectStoreNames.contains('kidsPlans')) {
          const kidsPlansStore = db.createObjectStore('kidsPlans', { keyPath: 'id' });
          kidsPlansStore.createIndex('by-sync', 'synced');
          kidsPlansStore.createIndex('by-unit', 'unitId');
          kidsPlansStore.createIndex('by-child', 'childId');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-synced', 'synced');
        }
      },
    });
  }

  private ensureDb(): IDBPDatabase<FlexKidsDB> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Generic CRUD operations
  async add(store: keyof FlexKidsDB, data: any): Promise<string> {
    const db = this.ensureDb();
    const id = data.id || this.generateId();
    await db.add(store as any, { ...data, id, synced: false });
    return id;
  }

  async get(store: keyof FlexKidsDB, id: string): Promise<any> {
    const db = this.ensureDb();
    return await db.get(store as any, id);
  }

  async getAll(store: keyof FlexKidsDB): Promise<any[]> {
    const db = this.ensureDb();
    return await db.getAll(store as any);
  }

  async update(store: keyof FlexKidsDB, id: string, data: any): Promise<void> {
    const db = this.ensureDb();
    const existing = await db.get(store as any, id);
    if (existing) {
      await db.put(store as any, { ...existing, ...data, id, synced: false });
    }
  }

  async upsert(store: keyof FlexKidsDB, data: any): Promise<string> {
    const db = this.ensureDb();
    const id = data.id || this.generateId();
    await db.put(store as any, { ...data, id, synced: false });
    return id;
  }

  async bulkUpsert(store: keyof FlexKidsDB, items: any[]): Promise<void> {
    if (items.length === 0) return;
    const db = this.ensureDb();
    const tx = db.transaction(store as any, 'readwrite');
    for (const item of items) {
      const id = item.id || this.generateId();
      // Preserve caller-supplied synced value (e.g. true for cache-only saves)
      const synced = item.synced !== undefined ? item.synced : false;
      tx.store.put({ ...item, id, synced } as any);
    }
    await tx.done;
  }

  async delete(store: keyof FlexKidsDB, id: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete(store as any, id);
  }

  async getAllByIndex(
    store: keyof FlexKidsDB,
    indexName: string,
    query?: IDBKeyRange | string | number
  ): Promise<any[]> {
    const db = this.ensureDb();
    return await db.getAllFromIndex(store as any, indexName, query);
  }

  // Sync queue operations
  async addToSyncQueue(
    collection: string,
    operation: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    const db = this.ensureDb();
    const id = this.generateId();
    await db.add('syncQueue', {
      id,
      collection,
      operation,
      data,
      timestamp: Date.now(),
      synced: 0,
      retryCount: 0,
    });
  }

  async migrateGhostSyncItems(): Promise<number> {
    if (this.ghostMigrationDone) return 0;
    const db = this.ensureDb();
    const allItems = await db.getAll('syncQueue');
    let migrated = 0;
    const tx = db.transaction('syncQueue', 'readwrite');
    for (const item of allItems) {
      if (typeof item.synced === 'boolean' || item.synced === undefined || item.synced === null) {
        const numericSynced = item.synced ? 1 : 0;
        await tx.store.put({ ...item, synced: numericSynced });
        migrated++;
      }
    }
    await tx.done;
    this.ghostMigrationDone = true;
    if (migrated > 0) {
      console.log(`Migrated ${migrated} ghost syncQueue items (boolean -> number)`);
    }
    return migrated;
  }

  async getPendingSyncItems(): Promise<any[]> {
    const db = this.ensureDb();
    // First migrate any ghost items with boolean synced
    await this.migrateGhostSyncItems();
    // Now the index query will find everything correctly
    return await db.getAllFromIndex('syncQueue', 'by-synced', 0);
  }

  async getSyncQueueItem(queueId: string): Promise<any | null> {
    const db = this.ensureDb();
    const item = await db.get('syncQueue', queueId);
    return item || null;
  }

  async markAsSynced(queueId: string): Promise<void> {
    const db = this.ensureDb();
    const item = await db.get('syncQueue', queueId);
    if (item) {
      await db.put('syncQueue', { ...item, synced: 1 });
    }
  }

  async incrementRetryCount(queueId: string): Promise<number> {
    const db = this.ensureDb();
    const item = await db.get('syncQueue', queueId);
    if (item) {
      const newCount = (item.retryCount || 0) + 1;
      // Set synced back to 0 so it gets picked up on next sync attempt
      await db.put('syncQueue', { ...item, retryCount: newCount, synced: 0 });
      return newCount;
    }
    return 0;
  }

  async removeSyncQueueItem(queueId: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('syncQueue', queueId);
  }

  async cleanupSyncedItems(): Promise<number> {
    const db = this.ensureDb();
    // Migration ensures all synced values are numbers, so index query works
    await this.migrateGhostSyncItems();
    const synced = await db.getAllFromIndex('syncQueue', 'by-synced', 1);
    let removed = 0;
    const tx = db.transaction('syncQueue', 'readwrite');
    for (const item of synced) {
      await tx.store.delete(item.id);
      removed++;
    }
    await tx.done;
    return removed;
  }

  async getPendingSyncCount(): Promise<number> {
    const db = this.ensureDb();
    await this.migrateGhostSyncItems();
    return await db.countFromIndex('syncQueue', 'by-synced', 0);
  }

  async clearSyncQueue(): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  async exportBackup(): Promise<Record<string, any[]>> {
    const db = this.ensureDb();
    const stores: Array<keyof FlexKidsDB> = ['visits', 'customers', 'children', 'payments', 'packages', 'kidsPlans', 'settings'];
    const backup: Record<string, any[]> = {};
    for (const store of stores) {
      backup[store] = await db.getAll(store as any);
    }
    backup._meta = [{ exportedAt: new Date().toISOString(), pendingSync: await this.getPendingSyncCount() }];
    return backup;
  }

  async updateReferences(oldId: string, newId: string): Promise<number> {
    const db = this.ensureDb();
    const refStores: Array<{ store: keyof FlexKidsDB; field: string }> = [
      { store: 'children', field: 'customerId' },
      { store: 'packages', field: 'customerId' },
      { store: 'payments', field: 'customerId' },
      { store: 'visits', field: 'customerId' },
      { store: 'visits', field: 'childId' },
      { store: 'payments', field: 'childId' },
      { store: 'packages', field: 'childId' },
    ];

    let updated = 0;

    for (const { store, field } of refStores) {
      try {
        const allItems = await db.getAll(store as any);
        const tx = db.transaction(store as any, 'readwrite');
        for (const item of allItems) {
          if (item[field] === oldId) {
            item[field] = newId;
            await tx.store.put(item);
            updated++;
          }
        }
        await tx.done;
      } catch {
        // Store may not exist or be empty
      }
    }

    // Also update references inside pending sync queue items
    try {
      const pending = await db.getAll('syncQueue');
      const tx = db.transaction('syncQueue', 'readwrite');
      for (const queueItem of pending) {
        let changed = false;
        if (queueItem.data) {
          for (const { field } of refStores) {
            if (queueItem.data[field] === oldId) {
              queueItem.data[field] = newId;
              changed = true;
            }
          }
        }
        if (changed) {
          await tx.store.put(queueItem);
          updated++;
        }
      }
      await tx.done;
    } catch {
      // Ignore sync queue errors
    }

    return updated;
  }

  // Mark item as synced in main stores
  async markItemAsSynced(store: keyof FlexKidsDB, id: string): Promise<void> {
    const db = this.ensureDb();
    const item = await db.get(store as any, id);
    if (item) {
      await db.put(store as any, { ...item, synced: true });
    }
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const localDb = new LocalDatabase();
