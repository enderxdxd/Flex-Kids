import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { FiscalNote } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'fiscalNotes';

export const fiscalNotesService = {
  async createFiscalNote(data: Omit<FiscalNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalNote> {
    const noteData = {
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
        const fiscalNote = {
          id: docRef.id,
          ...noteData,
        };

        await syncService.saveLocally(COLLECTION, 'create', fiscalNote);
        return fiscalNote;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(COLLECTION, 'create', noteData);
    return {
      id,
      ...noteData,
    };
  },

  async updateFiscalNote(
    id: string,
    updates: Partial<Omit<FiscalNote, 'id' | 'createdAt'>>
  ): Promise<void> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const noteRef = doc(db, COLLECTION, id);
        
        const firestoreData = {
          ...updates,
          updatedAt: Timestamp.now(),
        };

        await updateDoc(noteRef, firestoreData);
        
        const localNote = await syncService.getFromLocal(COLLECTION, id);
        const updatedNote = { ...localNote, ...updateData };
        await syncService.saveLocally(COLLECTION, 'update', updatedNote);
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localNote = await syncService.getFromLocal(COLLECTION, id);
    const updatedNote = { ...localNote, ...updateData };
    await syncService.saveLocally(COLLECTION, 'update', updatedNote);
  },

  async getFiscalNoteByVisit(visitId: string): Promise<FiscalNote | null> {
    try {
      const allNotes = await syncService.getAllFromLocal(COLLECTION);
      const note = allNotes.find((n: FiscalNote) => n.visitId === visitId);
      return note || null;
    } catch (error) {
      console.error('Error getting fiscal note by visit:', error);
      return null;
    }
  },

  async getFiscalNotesByCustomer(customerId: string): Promise<FiscalNote[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const notes = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            visitId: data.visitId,
            paymentId: data.paymentId,
            customerId: data.customerId,
            customerName: data.customerName,
            customerCpf: data.customerCpf,
            items: data.items,
            subtotal: data.subtotal,
            discount: data.discount,
            total: data.total,
            paymentMethod: data.paymentMethod,
            fiscalNumber: data.fiscalNumber,
            series: data.series,
            status: data.status,
            errorMessage: data.errorMessage,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as FiscalNote;
        });

        for (const note of notes) {
          await syncService.saveLocally(COLLECTION, 'create', note);
        }

        return notes;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const allNotes = await syncService.getAllFromLocal(COLLECTION);
    return allNotes.filter((note: FiscalNote) => note.customerId === customerId);
  },

  async getTodayFiscalNotes(): Promise<FiscalNote[]> {
    try {
      const localNotes = await syncService.getAllFromLocal(COLLECTION);
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      return localNotes
        .filter((note: FiscalNote) => {
          const noteDate = note.createdAt instanceof Date 
            ? note.createdAt 
            : new Date(note.createdAt);
          return noteDate >= startOfDay;
        })
        .sort((a: FiscalNote, b: FiscalNote) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      console.error('Error getting today fiscal notes:', error);
      return [];
    }
  },

  async getAllFiscalNotes(): Promise<FiscalNote[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const notes = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            visitId: data.visitId,
            paymentId: data.paymentId,
            customerId: data.customerId,
            customerName: data.customerName,
            customerCpf: data.customerCpf,
            items: data.items,
            subtotal: data.subtotal,
            discount: data.discount,
            total: data.total,
            paymentMethod: data.paymentMethod,
            fiscalNumber: data.fiscalNumber,
            series: data.series,
            status: data.status,
            errorMessage: data.errorMessage,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as FiscalNote;
        });

        for (const note of notes) {
          await syncService.saveLocally(COLLECTION, 'create', note);
        }

        return notes;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    return await syncService.getAllFromLocal(COLLECTION);
  },
};
