import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Customer, Child } from '../../types';
import { syncService } from '../../database/syncService';

const CUSTOMERS_COLLECTION = 'customers';
const CHILDREN_COLLECTION = 'children';

export const customersServiceOffline = {
  async createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
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
        const firestoreData = {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

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

        console.log('💾 Saving to local cache...');
        await syncService.saveLocally(CUSTOMERS_COLLECTION, 'create', customer);
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
        await syncService.saveLocally(CUSTOMERS_COLLECTION, 'update', {
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
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await deleteDoc(doc(db, CUSTOMERS_COLLECTION, id));
      } catch (error) {
        console.error('Failed to delete from Firebase:', error);
      }
    }
    try {
      const { localDb } = await import('../../database/localDb');
      await localDb.delete('customers', id);
    } catch (error) {
      console.error('Failed to delete from local cache:', error);
    }
  },

  async deleteChild(id: string): Promise<void> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await deleteDoc(doc(db, CHILDREN_COLLECTION, id));
      } catch (error) {
        console.error('Failed to delete child from Firebase:', error);
      }
    }
    try {
      const { localDb } = await import('../../database/localDb');
      await localDb.delete('children', id);
    } catch (error) {
      console.error('Failed to delete child from local cache:', error);
    }
  },

  async getAllCustomers(): Promise<Customer[]> {
    try {
      // 1. Busca do cache primeiro
      const localCustomers = await syncService.getAllFromLocal(CUSTOMERS_COLLECTION);
      console.log(`📦 Loaded ${localCustomers.length} customers from cache`);

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        console.log('📴 Offline mode - returning cached customers');
        return localCustomers as Customer[];
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        console.log('🌐 Online - fetching customers from Firebase in background');
        this.fetchCustomersFromFirebase()
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return localCustomers as Customer[];
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  },

  async fetchCustomersFromFirebase(): Promise<Customer[]> {
    try {
      console.log('📥 Fetching customers from Firebase...');
      const db = getDb();
      const snapshot = await getDocs(collection(db, CUSTOMERS_COLLECTION));
      console.log(`📥 Received ${snapshot.docs.length} customers from Firebase`);
      
      const customers: Customer[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const customer: Customer = {
          id: docSnap.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          cpf: data.cpf,
          address: data.address,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        customers.push(customer);
      }

      // Salva em paralelo
      await Promise.all(customers.map(customer => 
        syncService.saveLocally(CUSTOMERS_COLLECTION, 'create', customer).catch(() => {})
      ));
      console.log(`💾 Saved ${customers.length} customers to cache`);

      return customers;
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  },

  async addChild(customerId: string, data: Omit<Child, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>): Promise<Child> {
    const childData = {
      ...data,
      customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData = {
          ...data,
          customerId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), firestoreData);
        const child = {
          id: docRef.id,
          ...childData,
        };

        await syncService.saveLocally(CHILDREN_COLLECTION, 'create', child);
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
            customerId: data.customerId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          // Salva no cache para próximas vezes
          await syncService.saveLocally(CHILDREN_COLLECTION, 'create', childFromFirebase).catch(() => {});
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

          await syncService.saveLocally(CUSTOMERS_COLLECTION, 'create', customerFromFirebase).catch(() => {});
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
      
      const children: Child[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const child: Child = {
          id: docSnap.id,
          name: data.name,
          age: data.age,
          customerId: data.customerId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        children.push(child);
      }

      // Salva em paralelo
      await Promise.all(children.map(child => 
        syncService.saveLocally(CHILDREN_COLLECTION, 'create', child).catch(() => {})
      ));

      return children;
    } catch (error) {
      console.error('Error fetching children by customer:', error);
      return [];
    }
  },

  async getAllChildren(): Promise<Child[]> {
    try {
      // 1. Busca do cache primeiro
      const localChildren = await syncService.getAllFromLocal(CHILDREN_COLLECTION);

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return localChildren as Child[];
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        this.fetchChildrenFromFirebase()
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return localChildren as Child[];
    } catch (error) {
      console.error('Error getting children:', error);
      return [];
    }
  },

  async fetchChildrenFromFirebase(): Promise<Child[]> {
    try {
      const db = getDb();
      const snapshot = await getDocs(collection(db, CHILDREN_COLLECTION));
      
      const children: Child[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const child: Child = {
          id: docSnap.id,
          name: data.name,
          age: data.age,
          customerId: data.customerId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        children.push(child);
      }

      // Salva em paralelo
      await Promise.all(children.map(child => 
        syncService.saveLocally(CHILDREN_COLLECTION, 'create', child).catch(() => {})
      ));

      return children;
    } catch (error) {
      console.error('Error getting children:', error);
      return [];
    }
  },
};
