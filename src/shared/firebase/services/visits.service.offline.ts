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

  async getActiveVisits(unitId?: string): Promise<Visit[]> {
    try {
      // Primeiro tenta buscar do cache local (instantâneo)
      const localVisits = await syncService.getAllFromLocal(COLLECTION);
      const cachedActiveVisits = localVisits.filter((visit: Visit) => {
        const matchesUnit = !unitId || visit.unitId === unitId;
        const isActive = !visit.checkOut;
        return matchesUnit && isActive;
      });

      // Se offline, retorna cache imediatamente
      if (!syncService.isOnline()) {
        return cachedActiveVisits;
      }

      // Se online, busca do Firebase em background e atualiza cache
      try {
        const db = getDb();
        let q = query(
          collection(db, COLLECTION),
          where('checkOut', '==', null),
          orderBy('checkIn', 'desc')
        );

        if (unitId) {
          q = query(q, where('unitId', '==', unitId));
        }

        const snapshot = await getDocs(q);
        const visits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn?.toDate(),
          checkOut: doc.data().checkOut?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Visit[];

        // Atualiza cache local em background
        Promise.all(visits.map(visit => 
          syncService.saveLocally(COLLECTION, 'create', visit).catch(() => {})
        )).catch(console.error);

        return visits;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using cached data:', error);
        return cachedActiveVisits;
      }
    } catch (error) {
      console.error('Failed to access local cache, fetching from Firebase:', error);
      
      // Fallback: busca direto do Firebase se cache local falhar
      if (syncService.isOnline()) {
        const db = getDb();
        let q = query(
          collection(db, COLLECTION),
          where('checkOut', '==', null),
          orderBy('checkIn', 'desc')
        );

        if (unitId) {
          q = query(q, where('unitId', '==', unitId));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          checkIn: doc.data().checkIn?.toDate(),
          checkOut: doc.data().checkOut?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Visit[];
      }
      
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
