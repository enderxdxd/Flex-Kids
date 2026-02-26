import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Visit, CheckInData, CheckOutData } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'visits';

let _checkInLock = false;

export const visitsServiceOffline = {
  async hasActiveVisit(childId: string, unitId: string): Promise<boolean> {
    try {
      const localVisits = await syncService.getAllFromLocal(COLLECTION);
      const activeVisit = (localVisits as Visit[]).find(
        v => v.childId === childId && v.unitId === unitId && !v.checkOut
      );
      return !!activeVisit;
    } catch (error) {
      console.error('Error checking active visit:', error);
      return false;
    }
  },

  async checkIn(data: CheckInData): Promise<Visit> {
    if (_checkInLock) {
      throw new Error('Check-in já em andamento, aguarde.');
    }
    _checkInLock = true;

    try {
      return await this._doCheckIn(data);
    } finally {
      setTimeout(() => { _checkInLock = false; }, 2000);
    }
  },

  async _doCheckIn(data: CheckInData): Promise<Visit> {
    const visitData = {
      childId: data.childId,
      unitId: data.unitId,
      checkIn: new Date(),
      paid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData = {
          childId: data.childId,
          unitId: data.unitId,
          checkIn: Timestamp.now(),
          paid: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, COLLECTION), firestoreData);
        const visit = {
          id: docRef.id,
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

        await updateDoc(visitRef, firestoreData);
        
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
      // 1. Busca do cache usando índice by-unit (rápido)
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

      // Enriquecer com dados de criança e cliente
      cachedActiveVisits = await this.enrichVisitsWithChildData(cachedActiveVisits);

      // 2. Se offline, retorna cache imediatamente
      if (!syncService.isOnline()) {
        return cachedActiveVisits;
      }

      // 3. Sempre retorna cache primeiro (mesmo vazio) e busca Firebase em background
      // Isso garante resposta instantânea sempre
      if (syncService.isOnline()) {
        // Busca do Firebase em background (não bloqueia)
        this.fetchActiveVisitsFromFirebase(unitId, limit)
          .then(visits => {
            // Emite evento para atualizar UI se necessário
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('visits-updated', { 
                detail: { visits, unitId } 
              }));
            }
          })
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return cachedActiveVisits;
    } catch (error) {
      console.error('Error in getActiveVisits:', error);
      return [];
    }
  },

  async fetchActiveVisitsFromFirebase(unitId?: string, _limit?: number): Promise<Visit[]> {
    try {
      const db = getDb();
      const constraints: any[] = [where('checkOut', '==', null)];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('checkIn', 'desc'));
      const q = query(collection(db, COLLECTION), ...constraints);

      let snapshot = await getDocs(q);

      // Fallback: se filtrou por unitId e retornou 0, busca sem unitId e migra
      if (unitId && snapshot.docs.length === 0) {
        console.log('📥 Visits filtered query returned 0, fetching ALL active to migrate unitId...');
        const fallbackQ = query(collection(db, COLLECTION), where('checkOut', '==', null), orderBy('checkIn', 'desc'));
        snapshot = await getDocs(fallbackQ);
      }

      const visits: Visit[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const needsMigration = unitId && !data.unitId;

        if (needsMigration) {
          try {
            await updateDoc(doc(db, COLLECTION, docSnap.id), { unitId });
            console.log(`🔄 Migrated unitId for visit ${docSnap.id}`);
          } catch (err) {
            console.error(`Failed to migrate unitId for visit ${docSnap.id}:`, err);
          }
        }

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

      // Salva em batch (transação única)
      await syncService.bulkSaveToCacheOnly(COLLECTION, visits);

      return visits;
    } catch (error) {
      console.error('Error in getActiveVisits:', error);
      return [];
    }
  },

  async getVisitsByCustomer(customerId: string): Promise<Visit[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('childId', '==', customerId),
          orderBy('checkIn', 'desc')
        );

        const snapshot = await getDocs(q);
        const visits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn?.toDate(),
          checkOut: doc.data().checkOut?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Visit[];

        await syncService.bulkSaveToCacheOnly(COLLECTION, visits);

        return visits;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const allVisits = await syncService.getAllFromLocal(COLLECTION);
    return allVisits.filter((visit: Visit) => visit.childId === customerId);
  },

  async getAllVisits(unitId?: string): Promise<Visit[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const constraints: any[] = [];
        if (unitId) {
          constraints.push(where('unitId', '==', unitId));
        }
        constraints.push(orderBy('checkIn', 'desc'));
        const q = query(collection(db, COLLECTION), ...constraints);
        const snapshot = await getDocs(q);
        
        const visits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn?.toDate(),
          checkOut: doc.data().checkOut?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Visit[];

        await syncService.bulkSaveToCacheOnly(COLLECTION, visits);

        return visits;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const all = unitId
      ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId)
      : await syncService.getAllFromLocal(COLLECTION);
    return all;
  },
};
