import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Visit, CheckInData, CheckOutData } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'visits';

export const visitsServiceOffline = {
  async checkIn(data: CheckInData): Promise<Visit> {
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

        await syncService.saveLocally(COLLECTION, 'create', visit);
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
    const updateData = {
      checkOut: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const visitRef = doc(db, COLLECTION, data.visitId);
        
        const firestoreData = {
          checkOut: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await updateDoc(visitRef, firestoreData);
        
        const localVisit = await syncService.getFromLocal(COLLECTION, data.visitId);
        const updatedVisit = { ...localVisit, ...updateData };
        await syncService.saveLocally(COLLECTION, 'update', updatedVisit);
        
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

  async getActiveVisits(unitId?: string, limit?: number): Promise<Visit[]> {
    try {
      // 1. SEMPRE busca do cache primeiro (rápido - 5-10ms)
      const localVisits = await syncService.getAllFromLocal(COLLECTION);
      const cachedActiveVisits = localVisits
        .filter((visit: Visit) => {
          const matchesUnit = !unitId || visit.unitId === unitId;
          return matchesUnit && !visit.checkOut;
        })
        .sort((a: Visit, b: Visit) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        })
        .slice(0, limit);

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

  async fetchActiveVisitsFromFirebase(unitId?: string, limit?: number): Promise<Visit[]> {
    try {
      const db = getDb();
      const q = query(
        collection(db, COLLECTION),
        where('checkOut', '==', null),
        orderBy('checkIn', 'desc')
      );

      const snapshot = await getDocs(q);
      const visits: Visit[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const visit: Visit = {
          id: docSnap.id,
          childId: data.childId,
          unitId: data.unitId,
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

      // Salva em paralelo
      await Promise.all(visits.map(visit => 
        syncService.saveLocally(COLLECTION, 'create', visit).catch(() => {})
      ));

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

        for (const visit of visits) {
          await syncService.saveLocally(COLLECTION, 'create', visit);
        }

        return visits;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const allVisits = await syncService.getAllFromLocal(COLLECTION);
    return allVisits.filter((visit: Visit) => visit.childId === customerId);
  },

  async getAllVisits(): Promise<Visit[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(collection(db, COLLECTION), orderBy('checkIn', 'desc'));
        const snapshot = await getDocs(q);
        
        const visits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn?.toDate(),
          checkOut: doc.data().checkOut?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Visit[];

        for (const visit of visits) {
          await syncService.saveLocally(COLLECTION, 'create', visit);
        }

        return visits;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    return await syncService.getAllFromLocal(COLLECTION);
  },
};
