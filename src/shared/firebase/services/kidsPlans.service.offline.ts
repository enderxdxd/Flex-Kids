import { collection, addDoc, updateDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { getDocsSafe, isFirebaseConnectivityError } from '../firebaseHelpers';
import { KidsPlan } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'kidsPlans';

let _createLock = false;

export const kidsPlansServiceOffline = {
  async createPlan(data: Omit<KidsPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<KidsPlan> {
    if (_createLock) {
      throw new Error('Criação de plano já em andamento, aguarde.');
    }
    _createLock = true;

    try {
      return await this._doCreatePlan(data);
    } finally {
      setTimeout(() => { _createLock = false; }, 2000);
    }
  },

  async _doCreatePlan(data: Omit<KidsPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<KidsPlan> {
    const planData = {
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
          startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
          endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
        };
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        const docRef = await addDoc(collection(db, COLLECTION), firestoreData);
        const plan = {
          id: docRef.id,
          ...planData,
        };

        await syncService.saveToCacheOnly(COLLECTION, plan);
        return plan;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(COLLECTION, 'create', planData);
    return {
      id,
      ...planData,
    };
  },

  async updatePlan(id: string, data: Partial<KidsPlan>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const ref = doc(db, COLLECTION, id);

        const firestoreData: Record<string, any> = {
          ...data,
          updatedAt: Timestamp.now(),
        };

        if (data.startDate) {
          firestoreData.startDate = Timestamp.fromDate(new Date(data.startDate));
        }
        if (data.endDate) {
          firestoreData.endDate = Timestamp.fromDate(new Date(data.endDate));
        }
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        await updateDoc(ref, firestoreData);

        const localPlan = await syncService.getFromLocal(COLLECTION, id);
        await syncService.saveToCacheOnly(COLLECTION, { ...localPlan, ...updateData });
        return;
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localPlan = await syncService.getFromLocal(COLLECTION, id);
    await syncService.saveLocally(COLLECTION, 'update', { ...localPlan, ...updateData });
  },

  async deletePlan(id: string): Promise<void> {
    const softDeleteData = { deletedAt: new Date(), updatedAt: new Date() };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await updateDoc(doc(db, COLLECTION, id), {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('Failed to soft-delete plan from Firebase:', error);
      }
    }

    try {
      const existing = await syncService.getFromLocal(COLLECTION, id);
      if (existing) {
        await syncService.saveToCacheOnly(COLLECTION, { ...existing, ...softDeleteData });
      }
    } catch (error) {
      console.error('Failed to soft-delete plan from local cache:', error);
    }
  },

  async getAllPlans(unitId?: string): Promise<KidsPlan[]> {
    try {
      // 1. Busca do cache local primeiro
      const localPlans = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId) as KidsPlan[]
        : await syncService.getAllFromLocal(COLLECTION) as KidsPlan[];

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return localPlans.filter((p: any) => !p.deletedAt);
      }

      // 3. Se cache vazio e online, aguarda o fetch do Firebase
      if (localPlans.length === 0 && unitId) {
        try {
          const firebasePlans = await this.fetchFromFirebase(unitId);
          return firebasePlans;
        } catch {
          return [];
        }
      }

      // 4. Se já tem cache, busca Firebase em background para sincronizar
      if (unitId) {
        this.fetchFromFirebase(unitId)
          .catch(err => { if (!isFirebaseConnectivityError(err)) console.error('Background fetch kidsPlans failed:', err); });
      }

      return localPlans.filter((p: any) => !p.deletedAt);
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error getting all kids plans:', error);
      return [];
    }
  },

  async getActivePlans(unitId?: string): Promise<KidsPlan[]> {
    const all = await this.getAllPlans(unitId);
    return all.filter(p => p.status === 'active' || p.status === 'expiring');
  },

  async getPlansByChild(childId: string, unitId?: string): Promise<KidsPlan[]> {
    const all = await this.getAllPlans(unitId);
    return all.filter(p => p.childId === childId);
  },

  async getPlansByCustomer(customerId: string, unitId?: string): Promise<KidsPlan[]> {
    const all = await this.getAllPlans(unitId);
    return all.filter(p => p.customerId === customerId);
  },

  async fetchFromFirebase(unitId: string): Promise<KidsPlan[]> {
    try {
      const db = getDb();
      const q = query(
        collection(db, COLLECTION),
        where('unitId', '==', unitId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocsSafe(q);
      const plans: any[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          deletedAt: data.deletedAt?.toDate() || null,
        };
      });

      await syncService.bulkSaveToCacheOnly(COLLECTION, plans);

      return plans.filter(p => !p.deletedAt) as KidsPlan[];
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Failed to fetch kids plans from Firebase:', error);
      return [];
    }
  },
};
