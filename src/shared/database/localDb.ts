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
    indexes: { 'by-sync': string };
  };
  children: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-customer': string };
  };
  payments: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-date': number };
  };
  packages: {
    key: string;
    value: any;
    indexes: { 'by-sync': string; 'by-customer': string };
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
      synced: boolean;
    };
    indexes: { 'by-synced': number };
  };
}

class LocalDatabase {
  private db: IDBPDatabase<FlexKidsDB> | null = null;
  private readonly DB_NAME = 'flex-kids-db';
  private readonly DB_VERSION = 2;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<FlexKidsDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
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
        }

        // Children store
        if (!db.objectStoreNames.contains('children')) {
          const childrenStore = db.createObjectStore('children', { keyPath: 'id' });
          childrenStore.createIndex('by-sync', 'synced');
          childrenStore.createIndex('by-customer', 'customerId');
        }

        // Payments store
        if (!db.objectStoreNames.contains('payments')) {
          const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentStore.createIndex('by-sync', 'synced');
          paymentStore.createIndex('by-date', 'date');
        }

        // Packages store
        if (!db.objectStoreNames.contains('packages')) {
          const packageStore = db.createObjectStore('packages', { keyPath: 'id' });
          packageStore.createIndex('by-sync', 'synced');
          packageStore.createIndex('by-customer', 'customerId');
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
      synced: false,
    });
  }

  async getPendingSyncItems(): Promise<any[]> {
    const db = this.ensureDb();
    return await db.getAllFromIndex('syncQueue', 'by-synced', 0);
  }

  async markAsSynced(queueId: string): Promise<void> {
    const db = this.ensureDb();
    const item = await db.get('syncQueue', queueId);
    if (item) {
      await db.put('syncQueue', { ...item, synced: true });
    }
  }

  async clearSyncQueue(): Promise<void> {
    const db = this.ensureDb();
    const tx = db.transaction('syncQueue', 'readwrite');
    await tx.store.clear();
    await tx.done;
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
