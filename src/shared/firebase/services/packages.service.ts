import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Package } from '../../types';

const COLLECTION = 'packages';

export const packagesService = {
  async createPackage(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    const db = getDb();
    const packageData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : null,
    };

    const docRef = await addDoc(collection(db, COLLECTION), packageData);
    return {
      id: docRef.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async updatePackage(id: string, data: Partial<Package>): Promise<void> {
    const db = getDb();
    const packageRef = doc(db, COLLECTION, id);
    
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    if (data.expiresAt) {
      updateData.expiresAt = Timestamp.fromDate(data.expiresAt);
    }

    await updateDoc(packageRef, updateData);
  },

  async usePackageHours(id: string, hours: number): Promise<void> {
    const db = getDb();
    const packageRef = doc(db, COLLECTION, id);
    
    const snapshot = await getDocs(query(collection(db, COLLECTION), where('__name__', '==', id)));
    if (!snapshot.empty) {
      const currentUsed = snapshot.docs[0].data().usedHours || 0;
      await updateDoc(packageRef, {
        usedHours: currentUsed + hours,
        updatedAt: Timestamp.now(),
      });
    }
  },

  async deactivatePackage(id: string): Promise<void> {
    const db = getDb();
    const packageRef = doc(db, COLLECTION, id);
    
    await updateDoc(packageRef, {
      active: false,
      updatedAt: Timestamp.now(),
    });
  },

  async getPackagesByCustomer(customerId: string): Promise<Package[]> {
    const db = getDb();
    const q = query(
      collection(db, COLLECTION),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as Package[];
  },

  async getActivePackages(customerId?: string): Promise<Package[]> {
    const db = getDb();
    let q = query(
      collection(db, COLLECTION),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );

    if (customerId) {
      q = query(q, where('customerId', '==', customerId));
    }

    const snapshot = await getDocs(q);
    const now = new Date();
    
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
      }))
      .filter(pkg => {
        if (!pkg.expiresAt) return true;
        return pkg.expiresAt > now;
      }) as Package[];
  },
};
