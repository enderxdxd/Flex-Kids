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
    try {
      // 1. SEMPRE busca do cache primeiro
      const localPayments = await syncService.getAllFromLocal(COLLECTION);
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const cachedTodayPayments = localPayments
        .filter((payment: Payment) => {
          const paymentDate = payment.createdAt instanceof Date 
            ? payment.createdAt 
            : new Date(payment.createdAt);
          return paymentDate >= startOfDay;
        })
        .sort((a: Payment, b: Payment) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return cachedTodayPayments;
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        this.fetchTodayPaymentsFromFirebase()
          .then(payments => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('payments-updated', { 
                detail: { payments } 
              }));
            }
          })
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return cachedTodayPayments;
    } catch (error) {
      console.error('Error in getTodayPayments:', error);
      return [];
    }
  },

  async fetchTodayPaymentsFromFirebase(): Promise<Payment[]> {
    try {
      const db = getDb();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfDayTimestamp = Timestamp.fromDate(startOfDay);
      
      const q = query(
        collection(db, COLLECTION),
        where('createdAt', '>=', startOfDayTimestamp),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const payments: Payment[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const payment: Payment = {
          id: docSnap.id,
          customerId: data.customerId,
          childId: data.childId,
          childName: data.childName,
          amount: data.amount,
          method: data.method,
          status: data.status,
          type: data.type || 'visit',
          packageId: data.packageId,
          description: data.description,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        payments.push(payment);
      }

      // Salva em paralelo
      await Promise.all(payments.map(payment => 
        syncService.saveLocally(COLLECTION, 'create', payment).catch(() => {})
      ));

      return payments;
    } catch (error) {
      console.error('Error fetching payments from Firebase:', error);
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
            childId: data.childId,
            childName: data.childName,
            amount: data.amount,
            method: data.method,
            status: data.status,
            type: data.type || 'visit',
            packageId: data.packageId,
            unitId: data.unitId,
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

  async getMonthPayments(date: Date = new Date()): Promise<Payment[]> {
    try {
      const localPayments = await syncService.getAllFromLocal(COLLECTION);
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const cachedMonthPayments = localPayments
        .filter((payment: Payment) => {
          const paymentDate = payment.createdAt instanceof Date 
            ? payment.createdAt 
            : new Date(payment.createdAt);
          return paymentDate >= startOfMonth && paymentDate <= endOfMonth;
        })
        .sort((a: Payment, b: Payment) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

      if (!syncService.isOnline()) {
        return cachedMonthPayments;
      }

      if (syncService.isOnline()) {
        this.fetchMonthPaymentsFromFirebase(date)
          .then(payments => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('payments-updated', { 
                detail: { payments } 
              }));
            }
          })
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return cachedMonthPayments;
    } catch (error) {
      console.error('Error in getMonthPayments:', error);
      return [];
    }
  },

  async fetchMonthPaymentsFromFirebase(date: Date = new Date()): Promise<Payment[]> {
    try {
      const db = getDb();
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const q = query(
        collection(db, COLLECTION),
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth)),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const payments: Payment[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const payment: Payment = {
          id: docSnap.id,
          customerId: data.customerId,
          childId: data.childId,
          childName: data.childName,
          amount: data.amount,
          method: data.method,
          status: data.status,
          type: data.type || 'visit',
          packageId: data.packageId,
          description: data.description,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        payments.push(payment);
      }

      await Promise.all(payments.map(payment => 
        syncService.saveLocally(COLLECTION, 'create', payment).catch(() => {})
      ));

      return payments;
    } catch (error) {
      console.error('Error fetching month payments from Firebase:', error);
      return [];
    }
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
            childId: data.childId,
            childName: data.childName,
            amount: data.amount,
            method: data.method,
            status: data.status,
            type: data.type || 'visit',
            packageId: data.packageId,
            unitId: data.unitId,
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
