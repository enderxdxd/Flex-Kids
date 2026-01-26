import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Payment } from '../../types';

const COLLECTION = 'payments';

export const paymentsService = {
  async createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const db = getDb();
    const paymentData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), paymentData);
    return {
      id: docRef.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async updatePaymentStatus(id: string, status: string): Promise<void> {
    const db = getDb();
    const paymentRef = doc(db, COLLECTION, id);
    
    await updateDoc(paymentRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  },

  async getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
    const db = getDb();
    const q = query(
      collection(db, COLLECTION),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Payment[];
  },

  async getTodayPayments(): Promise<Payment[]> {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, COLLECTION),
      where('createdAt', '>=', Timestamp.fromDate(today)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Payment[];
  },

  async getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    const db = getDb();
    const q = query(
      collection(db, COLLECTION),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Payment[];
  },
};
