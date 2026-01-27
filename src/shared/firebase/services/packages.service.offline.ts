import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Package } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'packages';

export const packagesServiceOffline = {
  async createPackage(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    const packageData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const firestoreData = {
          ...data,
          sharedAcrossUnits: data.sharedAcrossUnits ?? true, // Por padrão, compartilhado
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : null,
        };

        const docRef = await addDoc(collection(db, COLLECTION), firestoreData);
        const pkg = {
          id: docRef.id,
          ...packageData,
        };

        await syncService.saveLocally(COLLECTION, 'create', pkg);
        return pkg;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    const id = await syncService.saveLocally(COLLECTION, 'create', packageData);
    return {
      id,
      ...packageData,
    };
  },

  async updatePackage(id: string, data: Partial<Package>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const packageRef = doc(db, COLLECTION, id);
        
        const firestoreData: any = {
          ...data,
          updatedAt: Timestamp.now(),
        };

        if (data.expiresAt) {
          firestoreData.expiresAt = Timestamp.fromDate(data.expiresAt);
        }

        await updateDoc(packageRef, firestoreData);
        
        const localPkg = await syncService.getFromLocal(COLLECTION, id);
        await syncService.saveLocally(COLLECTION, 'update', { ...localPkg, ...updateData });
        return;
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localPkg = await syncService.getFromLocal(COLLECTION, id);
    await syncService.saveLocally(COLLECTION, 'update', { ...localPkg, ...updateData });
  },

  async getPackagesByCustomer(customerId: string): Promise<Package[]> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, COLLECTION),
          where('customerId', '==', customerId),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const packages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          expiresAt: doc.data().expiresAt?.toDate(),
        })) as Package[];

        for (const pkg of packages) {
          await syncService.saveLocally(COLLECTION, 'create', pkg);
        }

        return packages;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using local data:', error);
      }
    }

    const allPackages = await syncService.getAllFromLocal(COLLECTION);
    return allPackages.filter((pkg: Package) => pkg.customerId === customerId);
  },

  async getActivePackages(customerId?: string): Promise<Package[]> {
    const now = new Date();

    try {
      // Busca do cache local primeiro (instantâneo)
      const allPackages = await syncService.getAllFromLocal(COLLECTION);
      const cachedActivePackages = allPackages.filter((pkg: Package) => {
        const matchesCustomer = !customerId || pkg.customerId === customerId;
        const isActive = pkg.active;
        const notExpired = !pkg.expiresAt || pkg.expiresAt > now;
        return matchesCustomer && isActive && notExpired;
      });

      // Se offline, retorna cache
      if (!syncService.isOnline()) {
        return cachedActivePackages;
      }

      // Se online, busca do Firebase e atualiza cache em background
      try {
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
        
        const packages = snapshot.docs
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

        // Atualiza cache em background
        Promise.all(packages.map(pkg =>
          syncService.saveLocally(COLLECTION, 'create', pkg).catch(() => {})
        )).catch(console.error);

        return packages;
      } catch (error) {
        console.error('Failed to fetch from Firebase, using cached data:', error);
        return cachedActivePackages;
      }
    } catch (error) {
      console.error('Failed to access local cache, fetching from Firebase:', error);
      
      // Fallback: busca direto do Firebase
      if (syncService.isOnline()) {
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
      }
      
      return [];
    }
  },
};
