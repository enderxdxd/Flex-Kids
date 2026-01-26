import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Customer, Child } from '../../types';

const CUSTOMERS_COLLECTION = 'customers';
const CHILDREN_COLLECTION = 'children';

export const customersService = {
  async createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const db = getDb();
    const customerData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), customerData);
    return {
      id: docRef.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    const db = getDb();
    const customerRef = doc(db, CUSTOMERS_COLLECTION, id);
    
    await updateDoc(customerRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async deleteCustomer(id: string): Promise<void> {
    const db = getDb();
    const customerRef = doc(db, CUSTOMERS_COLLECTION, id);
    await deleteDoc(customerRef);
  },

  async getCustomer(id: string): Promise<Customer | null> {
    const db = getDb();
    const customerRef = doc(db, CUSTOMERS_COLLECTION, id);
    const snapshot = await getDoc(customerRef);
    
    if (!snapshot.exists()) return null;
    
    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate(),
      updatedAt: snapshot.data().updatedAt?.toDate(),
    } as Customer;
  },

  async getAllCustomers(): Promise<Customer[]> {
    const db = getDb();
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Customer[];
  },

  async searchCustomers(searchTerm: string): Promise<Customer[]> {
    const db = getDb();
    const q = query(collection(db, CUSTOMERS_COLLECTION));
    const snapshot = await getDocs(q);
    
    const term = searchTerm.toLowerCase();
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Customer))
      .filter(customer => 
        customer.name.toLowerCase().includes(term) ||
        customer.phone.includes(term) ||
        customer.email?.toLowerCase().includes(term)
      );
  },

  async addChild(customerId: string, childData: Omit<Child, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>): Promise<Child> {
    const db = getDb();
    const data = {
      ...childData,
      customerId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, CHILDREN_COLLECTION), data);
    return {
      id: docRef.id,
      ...childData,
      customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async updateChild(id: string, data: Partial<Child>): Promise<void> {
    const db = getDb();
    const childRef = doc(db, CHILDREN_COLLECTION, id);
    
    await updateDoc(childRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async deleteChild(id: string): Promise<void> {
    const db = getDb();
    const childRef = doc(db, CHILDREN_COLLECTION, id);
    await deleteDoc(childRef);
  },

  async getChildrenByCustomer(customerId: string): Promise<Child[]> {
    const db = getDb();
    const q = query(
      collection(db, CHILDREN_COLLECTION),
      where('customerId', '==', customerId),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Child[];
  },

  async getAllChildren(): Promise<Child[]> {
    const db = getDb();
    const q = query(collection(db, CHILDREN_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Child[];
  },
};
