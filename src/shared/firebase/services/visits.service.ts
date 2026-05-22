import { collection, updateDoc, doc, getDocs, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { getDb } from '../config';
import { Visit, CheckInData, CheckOutData } from '../../types';

const COLLECTION = 'visits';

export const visitsService = {
  async checkIn(data: CheckInData): Promise<Visit> {
    const db = getDb();
    const visitRef = doc(collection(db, COLLECTION));
    const visitData = {
      childId: data.childId,
      unitId: data.unitId,
      checkIn: Timestamp.now(),
      paid: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.kidsPlanId) (visitData as any).kidsPlanId = data.kidsPlanId;

    await setDoc(visitRef, visitData);
    return {
      id: visitRef.id,
      childId: data.childId,
      unitId: data.unitId,
      checkIn: new Date(),
      paid: false,
      kidsPlanId: data.kidsPlanId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Visit;
  },

  async checkOut(data: CheckOutData): Promise<Visit> {
    const db = getDb();
    const visitRef = doc(db, COLLECTION, data.visitId);
    
    const checkOutTime = Timestamp.now();
    const updateData: any = {
      checkOut: checkOutTime,
      updatedAt: Timestamp.now(),
    };
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
    if (data.paid !== undefined) updateData.paid = data.paid;
    if (data.paymentId) updateData.paymentId = data.paymentId;
    if (data.packageId) updateData.packageId = data.packageId;

    await updateDoc(visitRef, updateData);

    return { id: data.visitId } as Visit;
  },

  async getActiveVisits(unitId?: string): Promise<Visit[]> {
    const db = getDb();
    const constraints: any[] = [where('checkOut', '==', null)];
    if (unitId) {
      constraints.push(where('unitId', '==', unitId));
    }
    constraints.push(orderBy('checkIn', 'desc'));
    const q = query(collection(db, COLLECTION), ...constraints);

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
