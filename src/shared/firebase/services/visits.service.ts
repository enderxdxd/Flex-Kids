import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Visit, CheckInData, CheckOutData } from '../../types';

const COLLECTION = 'visits';

export const visitsService = {
  async checkIn(data: CheckInData): Promise<Visit> {
    const db = getDb();
    const visitData = {
      childId: data.childId,
      unitId: data.unitId,
      checkIn: Timestamp.now(),
      paid: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), visitData);
    return {
      id: docRef.id,
      childId: data.childId,
      unitId: data.unitId,
      checkIn: new Date(),
      paid: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Visit;
  },

  async checkOut(data: CheckOutData): Promise<Visit> {
    const db = getDb();
    const visitRef = doc(db, COLLECTION, data.visitId);
    
    const checkOutTime = Timestamp.now();
    await updateDoc(visitRef, {
      checkOut: checkOutTime,
      updatedAt: Timestamp.now(),
    });

    return { id: data.visitId } as Visit;
  },

  async getActiveVisits(unitId?: string): Promise<Visit[]> {
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
  },

  async getVisitsByChild(childId: string): Promise<Visit[]> {
    const db = getDb();
    const q = query(
      collection(db, COLLECTION),
      where('childId', '==', childId),
      orderBy('checkIn', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      checkIn: doc.data().checkIn?.toDate(),
      checkOut: doc.data().checkOut?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Visit[];
  },

  async updateVisitPayment(visitId: string, paymentId: string, value: number): Promise<void> {
    const db = getDb();
    const visitRef = doc(db, COLLECTION, visitId);
    
    await updateDoc(visitRef, {
      paymentId,
      value,
      paid: true,
      updatedAt: Timestamp.now(),
    });
  },
};
