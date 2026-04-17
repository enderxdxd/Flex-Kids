import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { getDocsSafe, setDocSafe, updateDocSafe, isFirebaseConnectivityError } from '../firebaseHelpers';
import { Visit, CheckInData, CheckOutData } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'visits';

let _checkInLock = false;
const LOCK_COOLDOWN_MS = 5000;
let _lastCheckInAttempt: { childId: string; timestamp: number } | null = null;

async function acquireCheckInLock(childId: string): Promise<boolean> {
  if (_checkInLock) return false;
  const now = Date.now();
  if (_lastCheckInAttempt && _lastCheckInAttempt.childId === childId && now - _lastCheckInAttempt.timestamp < LOCK_COOLDOWN_MS) {
    console.warn(`[CheckIn] Rejecting duplicate attempt for child ${childId} (${now - _lastCheckInAttempt.timestamp}ms since last)`);
    return false;
  }
  _checkInLock = true;
  _lastCheckInAttempt = { childId, timestamp: now };
  return true;
}

function releaseCheckInLock(): void {
  _checkInLock = false;
}

export const visitsServiceOffline = {
  async hasActiveVisit(childId: string, unitId: string): Promise<boolean> {
    try {
      const localVisits = await syncService.getAllFromLocal(COLLECTION);
      const localActive = (localVisits as Visit[]).find(
        v => v.childId === childId && v.unitId === unitId && !v.checkOut
      );
      if (localActive) return true;

      const unitVisits = (localVisits as Visit[]).filter(v => v.unitId === unitId);
      if (unitVisits.length > 0) return false;

      if (syncService.isOnline()) {
        try {
          const db = getDb();
          const q = query(
            collection(db, COLLECTION),
            where('childId', '==', childId),
            where('unitId', '==', unitId),
            where('checkOut', '==', null)
          );
          const snapshot = await getDocsSafe(q);
          return !snapshot.empty;
        } catch (err) {
          console.warn('[hasActiveVisit] Firebase fallback failed:', (err as Error).message);
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking active visit:', error);
      return false;
    }
  },

  async checkIn(data: CheckInData): Promise<Visit> {
    const acquired = await acquireCheckInLock(data.childId);
    if (!acquired) {
      throw new Error('Check-in já em andamento, aguarde.');
    }

    try {
      return await this._doCheckIn(data);
    } finally {
      releaseCheckInLock();
    }
  },

  async _doCheckIn(data: CheckInData): Promise<Visit> {
    const alreadyActive = await this.hasActiveVisit(data.childId, data.unitId);
    if (alreadyActive) {
      throw new Error('Esta criança já possui um check-in ativo.');
    }

    const db = getDb();
    const visitRef = doc(collection(db, COLLECTION));
    const visitData: any = {
      id: visitRef.id,
      childId: data.childId,
      unitId: data.unitId,
      checkIn: new Date(),
      paid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (data.kidsPlanId) visitData.kidsPlanId = data.kidsPlanId;

    if (syncService.isOnline()) {
      try {
        const firestoreData: any = {
          childId: data.childId,
          unitId: data.unitId,
          checkIn: Timestamp.now(),
          paid: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        if (data.kidsPlanId) firestoreData.kidsPlanId = data.kidsPlanId;

        await setDocSafe(visitRef, firestoreData);
        const visit = {
          ...visitData,
        } as Visit;

        await syncService.saveToCacheOnly(COLLECTION, visit);
        return visit;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(COLLECTION, 'create', visitData);
    return {
      id,
      ...visitData,
    } as Visit;
  },

  async checkOut(data: CheckOutData): Promise<Visit> {
    const updateData: any = {
      checkOut: new Date(),
      updatedAt: new Date(),
    };
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
    if (data.packageId) updateData.packageId = data.packageId;

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const visitRef = doc(db, COLLECTION, data.visitId);
        
        const firestoreData: any = {
          checkOut: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        if (data.duration !== undefined) firestoreData.duration = data.duration;
        if (data.value !== undefined) firestoreData.value = data.value;
        if (data.paymentMethod) firestoreData.paymentMethod = data.paymentMethod;
        if (data.packageId) firestoreData.packageId = data.packageId;

        await updateDocSafe(visitRef, firestoreData);
        
        const localVisit = await syncService.getFromLocal(COLLECTION, data.visitId);
        const updatedVisit = { ...localVisit, ...updateData };
        await syncService.saveToCacheOnly(COLLECTION, updatedVisit);
        
        return updatedVisit as Visit;
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localVisit = await syncService.getFromLocal(COLLECTION, data.visitId);
    const updatedVisit = { ...localVisit, ...updateData };
    await syncService.saveLocally(COLLECTION, 'update', updatedVisit);
    
    return updatedVisit as Visit;
  },

  async enrichVisitsWithChildData(visits: Visit[]): Promise<Visit[]> {
    try {
      const [localChildren, localCustomers] = await Promise.all([
        syncService.getAllFromLocal('children'),
        syncService.getAllFromLocal('customers'),
      ]);

      const childMap = new Map(localChildren.map((c: any) => [c.id, c]));
      const customerMap = new Map(localCustomers.map((c: any) => [c.id, c]));

      return visits.map(visit => {
        const child = childMap.get(visit.childId);
        if (child) {
          const customer = customerMap.get(child.customerId);
          return {
            ...visit,
            child: {
              ...child,
              customer: customer || undefined,
            },
          };
        }
        return visit;
      });
    } catch (error) {
      console.error('Error enriching visits:', error);
      return visits;
    }
  },

  async getActiveVisits(unitId?: string, limit = 50): Promise<Visit[]> {
    try {
      const localVisits = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId)
        : await syncService.getAllFromLocal(COLLECTION);
      let cachedActiveVisits = localVisits
        .filter((visit: Visit) => !visit.checkOut)
        .sort((a: Visit, b: Visit) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        })
        .slice(0, limit);

      cachedActiveVisits = await this.enrichVisitsWithChildData(cachedActiveVisits);

      if (!syncService.isOnline()) {
        return cachedActiveVisits;
      }

      if (cachedActiveVisits.length === 0) {
        try {
          const firebaseVisits = await this.fetchActiveVisitsFromFirebase(unitId, limit);
          return await this.enrichVisitsWithChildData(firebaseVisits);
        } catch {
          return [];
        }
      }

      this.fetchActiveVisitsFromFirebase(unitId, limit)
        .then(async (visits) => {
          const activeOnly = visits.filter(v => v.checkIn && !v.checkOut);
          const enriched = await this.enrichVisitsWithChildData(activeOnly);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('visits-updated', { 
              detail: { visits: enriched, unitId } 
            }));
          }
        })
        .catch(err => {
          if (isFirebaseConnectivityError(err)) {
            console.warn('[Visits] Background fetch skipped (offline/timeout)');
          } else {
            console.error('Background fetch failed:', err);
          }
        });
      
      return cachedActiveVisits;
    } catch (error) {
      if (isFirebaseConnectivityError(error)) {
        console.warn('[Visits] getActiveVisits skipped (offline/timeout)');
      } else {
        console.error('Error in getActiveVisits:', error);
      }
      return [];
    }
  },

  async fetchActiveVisitsFromFirebase(unitId?: string, limitCount?: number): Promise<Visit[]> {
    try {
      const db = getDb();
      const constraints: any[] = [where('checkOut', '==', null)];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('checkIn', 'desc'));
      const q = query(collection(db, COLLECTION), ...constraints);

      const snapshot = await getDocsSafe(q);

      const visits: Visit[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        const visit: Visit = {
          id: docSnap.id,
          childId: data.childId,
          unitId: data.unitId || unitId || '',
          checkIn: data.checkIn?.toDate() || new Date(),
          checkOut: data.checkOut?.toDate(),
          duration: data.duration,
          value: data.value,
          paid: data.paid || false,
          paymentId: data.paymentId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        if (data.child) {
          visit.child = {
            id: data.child.id || '',
            name: data.child.name || '',
            age: data.child.age || 0,
            customerId: data.child.customerId || '',
            createdAt: data.child.createdAt?.toDate?.() || new Date(),
            updatedAt: data.child.updatedAt?.toDate?.() || new Date(),
          };
        }

        visits.push(visit);
      }

      await syncService.bulkSaveToCacheOnly(COLLECTION, visits);

      return typeof limitCount === 'number' ? visits.slice(0, limitCount) : visits;
    } catch (error) {
      if (isFirebaseConnectivityError(error)) {
        console.warn('[Visits] fetchActiveVisits skipped (offline/timeout)');
      } else {
        console.error('Error in getActiveVisits:', error);
      }
      return [];
    }
  },

  async getVisitsByCustomer(customerId: string): Promise<Visit[]> {
    const allChildren = await syncService.getAllFromLocal('children');
    const customerChildIds = new Set(
      allChildren.filter((c: any) => c.customerId === customerId).map((c: any) => c.id)
    );

    if (customerChildIds.size === 0) return [];

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const allVisits: Visit[] = [];
        for (const childId of customerChildIds) {
          const q = query(
            collection(db, COLLECTION),
            where('childId', '==', childId),
            orderBy('checkIn', 'desc')
          );
          const snapshot = await getDocsSafe(q);
          const visits = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            checkIn: d.data().checkIn?.toDate(),
            checkOut: d.data().checkOut?.toDate(),
            createdAt: d.data().createdAt?.toDate(),
            updatedAt: d.data().updatedAt?.toDate(),
          })) as Visit[];
          allVisits.push(...visits);
        }

        await syncService.bulkSaveToCacheOnly(COLLECTION, allVisits);
        return allVisits.sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      } catch (error) {
        if (!isFirebaseConnectivityError(error)) console.error('Failed to fetch visits by customer:', error);
      }
    }

    const allVisits = await syncService.getAllFromLocal(COLLECTION);
    return allVisits.filter((visit: Visit) => customerChildIds.has(visit.childId));
  },

  async getAllVisits(unitId?: string): Promise<Visit[]> {
    try {
      const localVisits = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId)
        : await syncService.getAllFromLocal(COLLECTION);

      if (!syncService.isOnline()) {
        return localVisits;
      }

      if (localVisits.length === 0) {
        try {
          return await this.fetchAllVisitsFromFirebase(unitId);
        } catch {
          return [];
        }
      }

      this.fetchAllVisitsFromFirebase(unitId)
        .then(visits => {
          if (typeof window !== 'undefined' && visits.length > 0) {
            window.dispatchEvent(new CustomEvent('visits-updated', {
              detail: { visits, unitId }
            }));
          }
        })
        .catch(err => {
          if (!isFirebaseConnectivityError(err)) console.error('Background fetchAll visits failed:', err);
        });

      return localVisits;
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error in getAllVisits:', error);
      return [];
    }
  },

  async fetchAllVisitsFromFirebase(unitId?: string): Promise<Visit[]> {
    const db = getDb();
    const constraints: any[] = [];
    if (unitId) {
      constraints.push(where('unitId', '==', unitId));
    }
    constraints.push(orderBy('checkIn', 'desc'));
    const q = query(collection(db, COLLECTION), ...constraints);
    const snapshot = await getDocsSafe(q);

    const visits = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      checkIn: d.data().checkIn?.toDate(),
      checkOut: d.data().checkOut?.toDate(),
      createdAt: d.data().createdAt?.toDate(),
      updatedAt: d.data().updatedAt?.toDate(),
    })) as Visit[];

    await syncService.bulkSaveToCacheOnly(COLLECTION, visits);
    return visits;
  },
};
