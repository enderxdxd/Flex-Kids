import { collection, addDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { getDocsSafe, isFirebaseConnectivityError } from '../firebaseHelpers';
import { Payment } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'payments';

let _createPaymentLock = false;

export const paymentsServiceOffline = {
  async createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    if (_createPaymentLock) {
      throw new Error('Criação de pagamento já em andamento, aguarde.');
    }
    _createPaymentLock = true;

    try {
      return await this._doCreatePayment(data);
    } finally {
      setTimeout(() => { _createPaymentLock = false; }, 2000);
    }
  },

  async _doCreatePayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const paymentData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData: Record<string, any> = {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        // Firestore rejects undefined values — remove them
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        const docRef = await addDoc(collection(db, COLLECTION), firestoreData);
        const payment = {
          id: docRef.id,
          ...paymentData,
        };

        await syncService.saveToCacheOnly(COLLECTION, payment);
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

  async getTodayPayments(unitId?: string): Promise<Payment[]> {
    try {
      // 1. SEMPRE busca do cache primeiro
      const localPayments = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId)
        : await syncService.getAllFromLocal(COLLECTION);
      
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

      // 3. Se cache vazio, aguarda Firebase (primeira carga / cache limpo)
      if (cachedTodayPayments.length === 0) {
        return await this.fetchTodayPaymentsFromFirebase(unitId);
      }

      // 4. Se já tem cache, busca Firebase em background para atualizar
      this.fetchTodayPaymentsFromFirebase(unitId)
        .then(payments => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('payments-updated', { 
              detail: { payments } 
            }));
          }
        })
        .catch(err => console.error('Background fetch failed:', err));
      
      return cachedTodayPayments;
    } catch (error) {
      console.error('Error in getTodayPayments:', error);
      return [];
    }
  },

  async fetchTodayPaymentsFromFirebase(unitId?: string): Promise<Payment[]> {
    try {
      const db = getDb();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfDayTimestamp = Timestamp.fromDate(startOfDay);
      
      const constraints: any[] = [
        where('createdAt', '>=', startOfDayTimestamp),
      ];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(
        collection(db, COLLECTION),
        ...constraints
      );

      const snapshot = await getDocsSafe(q);
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
          unitId: data.unitId,
          description: data.description,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        payments.push(payment);
      }

      // Salva em batch (transação única)
      await syncService.bulkSaveToCacheOnly(COLLECTION, payments);

      return payments;
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error fetching payments from Firebase:', error);
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
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocsSafe(q);
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

        await syncService.bulkSaveToCacheOnly(COLLECTION, payments);

        return payments;
      } catch (error) {
        if (!isFirebaseConnectivityError(error)) console.error('Failed to fetch payments by customer:', error);
      }
    }

    const allPayments = await syncService.getAllFromLocal(COLLECTION);
    return allPayments.filter((payment: Payment) => payment.customerId === customerId);
  },

  async getMonthPayments(date: Date = new Date(), unitId?: string): Promise<Payment[]> {
    try {
      const localPayments = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId)
        : await syncService.getAllFromLocal(COLLECTION);
      
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

      // Se cache vazio, aguarda Firebase
      if (cachedMonthPayments.length === 0) {
        return await this.fetchMonthPaymentsFromFirebase(date, unitId);
      }

      // Se já tem cache, busca Firebase em background
      this.fetchMonthPaymentsFromFirebase(date, unitId)
        .then(payments => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('payments-updated', { 
              detail: { payments } 
            }));
          }
        })
        .catch(err => console.error('Background fetch failed:', err));
      
      return cachedMonthPayments;
    } catch (error) {
      console.error('Error in getMonthPayments:', error);
      return [];
    }
  },

  async fetchMonthPaymentsFromFirebase(date: Date = new Date(), unitId?: string): Promise<Payment[]> {
    try {
      const db = getDb();
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const constraints: any[] = [
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth)),
      ];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(
        collection(db, COLLECTION),
        ...constraints
      );

      const snapshot = await getDocsSafe(q);
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
          unitId: data.unitId,
          description: data.description,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        payments.push(payment);
      }

      await syncService.bulkSaveToCacheOnly(COLLECTION, payments);

      return payments;
    } catch (error) {
      console.error('Error fetching month payments from Firebase:', error);
      return [];
    }
  },

  async getAllPayments(unitId?: string): Promise<Payment[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const constraints: any[] = [];
        if (unitId) {
          constraints.push(where('unitId', '==', unitId));
        }
        constraints.push(orderBy('createdAt', 'desc'));
        const q = query(collection(db, COLLECTION), ...constraints);
        const snapshot = await getDocsSafe(q);
        
        const payments: Payment[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          payments.push({
            id: docSnap.id,
            customerId: data.customerId,
            childId: data.childId,
            childName: data.childName,
            amount: data.amount,
            method: data.method,
            status: data.status,
            type: data.type || 'visit',
            packageId: data.packageId,
            unitId: data.unitId || unitId,
            description: data.description,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as Payment);
        }

        await syncService.bulkSaveToCacheOnly(COLLECTION, payments);

        return payments;
      } catch (error) {
        if (!isFirebaseConnectivityError(error)) console.error('Failed to fetch all payments:', error);
      }
    }

    const all = await syncService.getAllFromLocal(COLLECTION);
    return unitId ? all.filter((p: Payment) => p.unitId === unitId) : all;
  },
};
