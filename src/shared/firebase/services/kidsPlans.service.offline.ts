import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { getDocsSafe, setDocSafe, updateDocSafe, isFirebaseConnectivityError } from '../firebaseHelpers';
import { KidsPlan } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'kidsPlans';

let _createLock = false;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPlanCurrentlyActive(plan: KidsPlan): boolean {
  if (plan.status !== 'active' && plan.status !== 'expiring') return false;
  const startDate = toDate(plan.startDate);
  const endDate = toDate(plan.endDate);
  const now = new Date();
  if (startDate && startDate > now) return false;
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < now) return false;
  }
  return true;
}

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
    const db = getDb();
    const planRef = doc(collection(db, COLLECTION));
    const planData = {
      id: planRef.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const firestoreData: Record<string, any> = {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
          endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
        };
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        await setDocSafe(planRef, firestoreData);
        const plan = {
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

        await updateDocSafe(ref, firestoreData);

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
        await updateDocSafe(doc(db, COLLECTION, id), {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const existing = await syncService.getFromLocal(COLLECTION, id);
        if (existing) {
          await syncService.saveToCacheOnly(COLLECTION, { ...existing, ...softDeleteData });
        }
        return;
      } catch (error) {
        console.error('Failed to soft-delete plan in Firebase, queuing for sync:', error);
      }
    }

    const existing = await syncService.getFromLocal(COLLECTION, id);
    if (existing) {
      await syncService.saveLocally(COLLECTION, 'update', { ...existing, ...softDeleteData });
    }
  },

  async getAllPlans(unitId?: string): Promise<KidsPlan[]> {
    try {
      const localPlans = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId) as KidsPlan[]
        : await syncService.getAllFromLocal(COLLECTION) as KidsPlan[];

      if (!syncService.isOnline()) {
        return localPlans.filter((p: any) => !p.deletedAt);
      }

      if (localPlans.length === 0 && unitId) {
        try {
          const firebasePlans = await this.fetchFromFirebase(unitId);
          return firebasePlans;
        } catch {
          return [];
        }
      }

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
    return all.filter(isPlanCurrentlyActive);
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
