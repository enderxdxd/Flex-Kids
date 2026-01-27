import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Payment } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'payments';

export const paymentsServiceOffline = {
  async createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const paymentData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData = {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, COLLECTION), firestoreData);
        const payment = {
          id: docRef.id,
          ...paymentData,
        };

        await syncService.saveLocally(COLLECTION, 'create', payment);
        return payment;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(COLLECTION, 'create', paymentData);
    return {
      id,
      ...paymentData,
    };
  },

  async getTodayPayments(): Promise<Payment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Busca do cache local primeiro (instantâneo)
      const allPayments = await syncService.getAllFromLocal(COLLECTION);
      const cachedTodayPayments = allPayments.filter((payment: Payment) => {
        const paymentDate = new Date(payment.createdAt);
        paymentDate.setHours(0, 0, 0, 0);
        return paymentDate.getTime() === today.getTime();
      });

      // Se offline, retorna cache
      if (!syncService.isOnline()) {
        return cachedTodayPayments;
      }

      // Se online, busca do Firebase e atualiza cache em background
      try {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('createdAt', '>=', Timestamp.fromDate(today)),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const payments = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerId: data.customerId,
            amount: data.amount,
            method: data.method,
            status: data.status,
            description: data.description,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Payment;
        });

        // Atualiza cache em background
        Promise.all(payments.map(payment =>
          syncService.saveLocally(COLLECTION, 'create', payment).catch(() => {})
        )).catch(console.error);

        return payments;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using cached data:', error);
        return cachedTodayPayments;
      }
    } catch (error) {
      console.error('Failed to access local cache, fetching from Firebase:', error);
      
      // Fallback: busca direto do Firebase
      if (syncService.isOnline()) {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('createdAt', '>=', Timestamp.fromDate(today)),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerId: data.customerId,
            amount: data.amount,
            method: data.method,
            status: data.status,
            description: data.description,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Payment;
        });
      }
      
      return [];
    }
  },

  async getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('customerId', '==', customerId),
          orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        const payments = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerId: data.customerId,
            amount: data.amount,
            method: data.method,
            status: data.status,
            description: data.description,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Payment;
        });

        for (const payment of payments) {
          await syncService.saveLocally(COLLECTION, 'create', payment);
        }

        return payments;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const allPayments = await syncService.getAllFromLocal(COLLECTION);
    return allPayments.filter((payment: Payment) => payment.customerId === customerId);
  },

  async getAllPayments(): Promise<Payment[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const payments = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerId: data.customerId,
            amount: data.amount,
            method: data.method,
            status: data.status,
            description: data.description,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Payment;
        });

        for (const payment of payments) {
          await syncService.saveLocally(COLLECTION, 'create', payment);
        }

        return payments;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    return await syncService.getAllFromLocal(COLLECTION);
  },
};
