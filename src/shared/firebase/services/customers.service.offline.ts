import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Customer, Child } from '../../types';
import { syncService } from '../../database/syncService';

const CUSTOMERS_COLLECTION = 'customers';
const CHILDREN_COLLECTION = 'children';

let _createCustomerLock = false;
let _addChildLock = false;

export const customersServiceOffline = {
  async createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    if (_createCustomerLock) {
      throw new Error('Criação de cliente já em andamento, aguarde.');
    }
    _createCustomerLock = true;

    try {
      return await this._doCreateCustomer(data);
    } finally {
      setTimeout(() => { _createCustomerLock = false; }, 2000);
    }
  },

  async _doCreateCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    console.log('🔵 createCustomer called with:', data);
    
    const customerData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      console.log('🌐 Online - attempting Firebase save with timeout');
      try {
        const db = getDb();
        const firestoreData: Record<string, any> = {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        // Firestore rejects undefined values — remove them
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        console.log('📤 Saving to Firebase...');
        console.log('📍 Collection:', CUSTOMERS_COLLECTION);
        console.log('📦 Data:', firestoreData);
        
        // Timeout de 10 segundos para operação Firebase
        const savePromise = addDoc(collection(db, CUSTOMERS_COLLECTION), firestoreData);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout after 10s - Check Firestore connection')), 10000)
        );
        
        const docRef = await Promise.race([savePromise, timeoutPromise]) as any;
        console.log('✅ Firebase save successful, ID:', docRef.id);
        
        const customer = {
          id: docRef.id,
          ...customerData,
        };

        console.log('💾 Saving to local cache (already synced)...');
        await syncService.saveToCacheOnly(CUSTOMERS_COLLECTION, customer);
        console.log('✅ Local cache save successful');
        
        return customer;
      } catch (error) {
        console.error('❌ Failed to save to Firebase (timeout or error), saving locally:', error);
        // Continua para salvar localmente
      }
    } else {
      console.log('📴 Offline - saving locally only');
    }

    console.log('💾 Saving to local cache (offline mode)...');
    const id = await syncService.saveLocally(CUSTOMERS_COLLECTION, 'create', customerData);
    console.log('✅ Local save successful, ID:', id);
    
    const result = {
      id,
      ...customerData,
    } as Customer;
    
    console.log('🔙 Returning customer object:', result);
    return result;
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const customerRef = doc(db, CUSTOMERS_COLLECTION, id);
        
        await updateDoc(customerRef, {
          ...data,
          updatedAt: Timestamp.now(),
        });

        const localCustomer = await syncService.getFromLocal(CUSTOMERS_COLLECTION, id);
        await syncService.saveToCacheOnly(CUSTOMERS_COLLECTION, {
          ...localCustomer,
          ...updateData,
        });
        return;
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localCustomer = await syncService.getFromLocal(CUSTOMERS_COLLECTION, id);
    await syncService.saveLocally(CUSTOMERS_COLLECTION, 'update', {
      ...localCustomer,
      ...updateData,
    });
  },

  async deleteCustomer(id: string): Promise<void> {
    const softDeleteData = { deletedAt: new Date(), updatedAt: new Date() };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await updateDoc(doc(db, CUSTOMERS_COLLECTION, id), {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Failed to soft-delete from Firebase:', error);
      }
    }

    // Mark as deleted locally (keep data for recovery)
    try {
      const existing = await syncService.getFromLocal(CUSTOMERS_COLLECTION, id);
      if (existing) {
        await syncService.saveToCacheOnly(CUSTOMERS_COLLECTION, { ...existing, ...softDeleteData });
      }
    } catch (error) {
      console.error('Failed to soft-delete from local cache:', error);
    }
  },

  async deleteChild(id: string): Promise<void> {
    const softDeleteData = { deletedAt: new Date(), updatedAt: new Date() };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await updateDoc(doc(db, CHILDREN_COLLECTION, id), {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Failed to soft-delete child from Firebase:', error);
      }
    }

    try {
      const existing = await syncService.getFromLocal(CHILDREN_COLLECTION, id);
      if (existing) {
        await syncService.saveToCacheOnly(CHILDREN_COLLECTION, { ...existing, ...softDeleteData });
      }
    } catch (error) {
      console.error('Failed to soft-delete child from local cache:', error);
    }
  },

  async getAllCustomers(unitId?: string): Promise<Customer[]> {
    try {
      // 1. Busca do cache primeiro
      const localCustomers = await syncService.getAllFromLocal(CUSTOMERS_COLLECTION) as Customer[];
      console.log(`📦 Loaded ${localCustomers.length} customers from cache`);

      // 2. Se offline, retorna cache (filtrado por unidade se necessário)
      if (!syncService.isOnline()) {
        console.log('📴 Offline mode - returning cached customers');
        return unitId ? localCustomers.filter(c => c.unitId === unitId) : localCustomers;
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        console.log('🌐 Online - fetching customers from Firebase in background');
        this.fetchCustomersFromFirebase(unitId)
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return unitId ? localCustomers.filter(c => c.unitId === unitId) : localCustomers;
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  },

  async fetchCustomersFromFirebase(unitId?: string): Promise<Customer[]> {
    try {
      console.log('📥 Fetching customers from Firebase...');
      const db = getDb();
      const q = unitId
        ? query(collection(db, CUSTOMERS_COLLECTION), where('unitId', '==', unitId))
        : collection(db, CUSTOMERS_COLLECTION);
      const snapshot = await getDocs(q);
      console.log(`📥 Received ${snapshot.docs.length} customers from Firebase`);
      
      const customers: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const customer: any = {
          id: docSnap.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          cpf: data.cpf,
          address: data.address,
          unitId: data.unitId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        if (data.deletedAt) customer.deletedAt = data.deletedAt.toDate();
        customers.push(customer);
      }

      // Salva em paralelo (including soft-deleted to keep them marked)
      await Promise.all(customers.map(customer => 
        syncService.saveToCacheOnly(CUSTOMERS_COLLECTION, customer).catch(() => {})
      ));
      console.log(`💾 Saved ${customers.length} customers to cache`);

      // Return only non-deleted
      return customers.filter(c => !c.deletedAt) as Customer[];
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  },

  async addChild(customerId: string, data: Omit<Child, 'id' | 'customerId' | 'createdAt' | 'updatedAt'> & { unitId?: string }): Promise<Child> {
    if (_addChildLock) {
      throw new Error('Criação de criança já em andamento, aguarde.');
    }
    _addChildLock = true;

    try {
      return await this._doAddChild(customerId, data);
    } finally {
      setTimeout(() => { _addChildLock = false; }, 2000);
    }
  },

  async _doAddChild(customerId: string, data: Omit<Child, 'id' | 'customerId' | 'createdAt' | 'updatedAt'> & { unitId?: string }): Promise<Child> {
    const childData = {
      ...data,
      customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData: Record<string, any> = {
          ...data,
          customerId,
          unitId: data.unitId,
          birthDate: data.birthDate ? Timestamp.fromDate(new Date(data.birthDate)) : null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        // Firestore rejects undefined values — remove them
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), firestoreData);
        const child = {
          id: docRef.id,
          ...childData,
        };

        await syncService.saveToCacheOnly(CHILDREN_COLLECTION, child);
        return child;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(CHILDREN_COLLECTION, 'create', childData);
    return {
      id,
      ...childData,
    } as Child;
  },

  async getChildById(childId: string): Promise<Child | null> {
    try {
      // 1. Busca do cache local primeiro (rápido)
      const localChildren = await syncService.getAllFromLocal(CHILDREN_COLLECTION);
      const child = (localChildren as Child[]).find(c => c.id === childId);
      
      if (child) {
        console.log(`✅ [getChildById] Criança encontrada no cache local`);
        return child;
      }

      console.warn(`⚠️ [getChildById] Criança ${childId} NÃO encontrada no cache local`);

      // 2. Fallback: busca direto do Firebase por documento
      if (syncService.isOnline()) {
        console.log(`🌐 [getChildById] Buscando do Firebase...`);
        const db = getDb();
        const docSnap = await getDoc(doc(db, CHILDREN_COLLECTION, childId));
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const childFromFirebase: Child = {
            id: docSnap.id,
            name: data.name,
            age: data.age,
            birthDate: data.birthDate?.toDate() || undefined,
            customerId: data.customerId,
            unitId: data.unitId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          // Salva no cache para próximas vezes
          await syncService.saveToCacheOnly(CHILDREN_COLLECTION, childFromFirebase).catch(() => {});
          console.log(`✅ [getChildById] Criança encontrada no Firebase e salva no cache`);
          return childFromFirebase;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting child by id:', error);
      return null;
    }
  },

  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      // 1. Busca do cache local primeiro
      const localCustomers = await syncService.getAllFromLocal(CUSTOMERS_COLLECTION);
      const customer = (localCustomers as Customer[]).find(c => c.id === customerId);
      
      if (customer) {
        console.log(`✅ [getCustomerById] Cliente encontrado no cache local`);
        return customer;
      }

      console.warn(`⚠️ [getCustomerById] Cliente ${customerId} NÃO encontrado no cache local`);

      // 2. Fallback: busca do Firebase
      if (syncService.isOnline()) {
        console.log(`🌐 [getCustomerById] Buscando do Firebase...`);
        const db = getDb();
        const docSnap = await getDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const customerFromFirebase: Customer = {
            id: docSnap.id,
            name: data.name,
            phone: data.phone,
            email: data.email,
            cpf: data.cpf,
            address: data.address,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          await syncService.saveToCacheOnly(CUSTOMERS_COLLECTION, customerFromFirebase).catch(() => {});
          console.log(`✅ [getCustomerById] Cliente encontrado no Firebase e salvo no cache`);
          return customerFromFirebase;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting customer by id:', error);
      return null;
    }
  },

  async getChildrenByCustomer(customerId: string): Promise<Child[]> {
    try {
      // 1. Busca do cache primeiro
      const localChildren = await syncService.getAllFromLocal(CHILDREN_COLLECTION);
      const customerChildren = (localChildren as Child[]).filter(c => c.customerId === customerId);

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return customerChildren;
      }

      // 3. Busca do Firebase em background
      this.fetchChildrenByCustomerFromFirebase(customerId)
        .catch(err => console.error('Background fetch failed:', err));
      
      return customerChildren;
    } catch (error) {
      console.error('Error getting children by customer:', error);
      return [];
    }
  },

  async fetchChildrenByCustomerFromFirebase(customerId: string): Promise<Child[]> {
    try {
      const db = getDb();
      const q = query(
        collection(db, CHILDREN_COLLECTION),
        where('customerId', '==', customerId)
      );
      const snapshot = await getDocs(q);
      
      const children: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const child: any = {
          id: docSnap.id,
          name: data.name,
          age: data.age,
          birthDate: data.birthDate?.toDate() || undefined,
          customerId: data.customerId,
          unitId: data.unitId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        if (data.deletedAt) child.deletedAt = data.deletedAt.toDate();
        children.push(child);
      }

      // Salva em paralelo
      await Promise.all(children.map(child => 
        syncService.saveToCacheOnly(CHILDREN_COLLECTION, child).catch(() => {})
      ));

      return children.filter(c => !c.deletedAt) as Child[];
    } catch (error) {
      console.error('Error fetching children by customer:', error);
      return [];
    }
  },

  async getAllChildren(unitId?: string): Promise<Child[]> {
    try {
      // 1. Busca do cache primeiro
      const localChildren = await syncService.getAllFromLocal(CHILDREN_COLLECTION) as Child[];

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return unitId ? localChildren.filter(c => c.unitId === unitId) : localChildren;
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        this.fetchChildrenFromFirebase(unitId)
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return unitId ? localChildren.filter(c => c.unitId === unitId) : localChildren;
    } catch (error) {
      console.error('Error getting children:', error);
      return [];
    }
  },

  async fetchChildrenFromFirebase(unitId?: string): Promise<Child[]> {
    try {
      const db = getDb();
      const q = unitId
        ? query(collection(db, CHILDREN_COLLECTION), where('unitId', '==', unitId))
        : collection(db, CHILDREN_COLLECTION);
      const snapshot = await getDocs(q);
      
      const children: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const child: any = {
          id: docSnap.id,
          name: data.name,
          age: data.age,
          birthDate: data.birthDate?.toDate() || undefined,
          customerId: data.customerId,
          unitId: data.unitId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        if (data.deletedAt) child.deletedAt = data.deletedAt.toDate();
        children.push(child);
      }

      // Salva em paralelo
      await Promise.all(children.map(child => 
        syncService.saveToCacheOnly(CHILDREN_COLLECTION, child).catch(() => {})
      ));

      return children.filter(c => !c.deletedAt) as Child[];
    } catch (error) {
      console.error('Error getting children:', error);
      return [];
    }
  },
};
