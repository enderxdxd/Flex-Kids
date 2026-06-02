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
  fiscalNotes: {
    key: string;
    value: any;
    indexes: { 'by-sync': string };
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
  private readonly DB_VERSION = 5;
  private ghostMigrationDone = false;

  async init(): Promise<void> {
    if (this.db) return;

    this.ghostMigrationDone = false;
    this.db = await openDB<FlexKidsDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('visits')) {
          const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
          visitStore.createIndex('by-sync', 'synced');
          visitStore.createIndex('by-unit', 'unitId');
        }

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

        if (!db.objectStoreNames.contains('kidsPlans')) {
          const kidsPlansStore = db.createObjectStore('kidsPlans', { keyPath: 'id' });
          kidsPlansStore.createIndex('by-sync', 'synced');
          kidsPlansStore.createIndex('by-unit', 'unitId');
          kidsPlansStore.createIndex('by-child', 'childId');
        }

        if (!db.objectStoreNames.contains('fiscalNotes')) {
          const fiscalNotesStore = db.createObjectStore('fiscalNotes', { keyPath: 'id' });
          fiscalNotesStore.createIndex('by-sync', 'synced');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-synced', 'synced');
        }
      },
    });

    await this.migrateGhostSyncItems();
  }

  private ensureDb(): IDBPDatabase<FlexKidsDB> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

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
      const synced = data.synced !== undefined ? data.synced : false;
      await db.put(store as any, { ...existing, ...data, id, synced });
    }
  }

  async upsert(store: keyof FlexKidsDB, data: any): Promise<string> {
    const db = this.ensureDb();
    const id = data.id || this.generateId();
    const callerSynced = data.synced !== undefined ? data.synced : false;
    if (callerSynced === true || callerSynced === 1) {
      const existing = await db.get(store as any, id);
      if (existing && (existing.synced === 0 || existing.synced === false)) {
        return id;
      }
    }
    await db.put(store as any, { ...data, id, synced: callerSynced });
    return id;
  }

  async bulkUpsert(store: keyof FlexKidsDB, items: any[]): Promise<void> {
    if (items.length === 0) return;
    const db = this.ensureDb();
    const tx = db.transaction(store as any, 'readwrite');
    for (const item of items) {
      const id = item.id || this.generateId();
      const callerSynced = item.synced !== undefined ? item.synced : false;
      if (callerSynced === true || callerSynced === 1) {
        const existing = await tx.store.get(id as any);
        if (existing && (existing.synced === 0 || existing.synced === false)) {
          continue;
        }
      }
      tx.store.put({ ...item, id, synced: callerSynced } as any);
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

  async addToSyncQueue(
    collection: string,
    operation: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    const db = this.ensureDb();
    const dataId = data?.id;
    const now = Date.now();

    if (dataId) {
      const pendingItems = await db.getAllFromIndex('syncQueue', 'by-synced', 0);
      const sameTarget = pendingItems.filter(
        item => item.collection === collection && item.data?.id === dataId
      );

      const existingCreate = sameTarget.find(item => item.operation === 'create');
      const existingUpdate = sameTarget.find(item => item.operation === 'update');
      const existingDelete = sameTarget.find(item => item.operation === 'delete');

      if (operation === 'update') {
        if (existingCreate) {
          await db.put('syncQueue', {
            ...existingCreate,
            data: { ...existingCreate.data, ...data },
            timestamp: now,
          });
          return;
        }

        if (existingUpdate) {
          await db.put('syncQueue', {
            ...existingUpdate,
            data: { ...existingUpdate.data, ...data },
            timestamp: now,
          });
          return;
        }
      }

      if (operation === 'delete') {
        if (existingCreate) {
          await db.delete('syncQueue', existingCreate.id);
          if (existingUpdate) {
            await db.delete('syncQueue', existingUpdate.id);
          }
          return;
        }

        if (existingUpdate) {
          await db.delete('syncQueue', existingUpdate.id);
        }

        if (existingDelete) {
          await db.put('syncQueue', {
            ...existingDelete,
            data,
            timestamp: now,
          });
          return;
        }
      }

      if (operation === 'create' && existingCreate) {
        await db.put('syncQueue', {
          ...existingCreate,
          data: { ...existingCreate.data, ...data },
          timestamp: now,
        });
        return;
      }
    }

    const id = this.generateId();
    await db.add('syncQueue', {
      id,
      collection,
      operation,
      data,
      timestamp: now,
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
    const stores: Array<keyof FlexKidsDB> = ['visits', 'customers', 'children', 'payments', 'packages', 'kidsPlans', 'fiscalNotes', 'settings'];
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
        // Best-effort reference repair; ignore stores that are missing or incompatible.
      }
    }

    try {
      const pending = await db.getAll('syncQueue');
      const tx = db.transaction('syncQueue', 'readwrite');
      for (const queueItem of pending) {
        let changed = false;
        if (queueItem.data) {
          // Repair foreign-key references
          for (const { field } of refStores) {
            if (queueItem.data[field] === oldId) {
              queueItem.data[field] = newId;
              changed = true;
            }
          }
          // Repair the entity's own id (e.g. update/delete enqueued offline against a record
          // that was later assigned a Firebase id). Without this, queued updates/deletes against
          // the old local_ id are silently skipped by syncItem when it sees the local_ prefix.
          if (queueItem.data.id === oldId) {
            queueItem.data.id = newId;
            changed = true;
          }
        }
        if (changed) {
          await tx.store.put(queueItem);
          updated++;
        }
      }
      await tx.done;
    } catch {
      // Best-effort queue repair; keep the rest of the migration path running.
    }

    return updated;
  }

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
