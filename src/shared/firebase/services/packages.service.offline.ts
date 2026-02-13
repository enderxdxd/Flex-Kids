import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
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

  async deletePackage(id: string): Promise<void> {
    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await deleteDoc(doc(db, COLLECTION, id));
      } catch (error) {
        console.error('Failed to delete package from Firebase:', error);
      }
    }
    try {
      const { localDb } = await import('../../database/localDb');
      await localDb.delete('packages', id);
    } catch (error) {
      console.error('Failed to delete package from local cache:', error);
    }
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

  async getAllPackages(): Promise<Package[]> {
    try {
      const localPackages = await syncService.getAllFromLocal(COLLECTION);
      return localPackages as Package[];
    } catch (error) {
      console.error('Error getting all packages:', error);
      return [];
    }
  },

  async usePackage(packageId: string, hoursUsed: number): Promise<void> {
    try {
      const pkg = await syncService.getFromLocal(COLLECTION, packageId);
      if (!pkg) {
        throw new Error('Package not found');
      }

      const newUsedHours = (pkg.usedHours || 0) + hoursUsed;
      const isActive = newUsedHours < pkg.hours;

      await this.updatePackage(packageId, {
        usedHours: newUsedHours,
        active: isActive,
      });
    } catch (error) {
      console.error('Error using package:', error);
      throw error;
    }
  },

  async getActivePackages(customerId?: string): Promise<Package[]> {
    try {
      // 1. SEMPRE busca do cache primeiro
      const localPackages = await syncService.getAllFromLocal(COLLECTION);
      const cachedPackages = localPackages
        .filter((pkg: Package) => {
          const matchesCustomer = !customerId || pkg.customerId === customerId;
          return matchesCustomer && pkg.active && pkg.usedHours < pkg.hours;
        })
        .sort((a: Package, b: Package) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return cachedPackages;
      }

      // 3. Sempre retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        this.fetchActivePackagesFromFirebase(customerId)
          .then(packages => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('packages-updated', { 
                detail: { packages, customerId } 
              }));
            }
          })
          .catch(err => console.error('Background fetch failed:', err));
      }
      
      return cachedPackages;
    } catch (error) {
      console.error('Error in getActivePackages:', error);
      return [];
    }
  },

  async fetchActivePackagesFromFirebase(customerId?: string): Promise<Package[]> {
    try {
      const db = getDb();
      const q = query(
        collection(db, COLLECTION),
        where('active', '==', true),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const packages: Package[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const pkg: Package = {
          id: docSnap.id,
          customerId: data.customerId,
          childId: data.childId,
          type: data.type,
          hours: data.hours,
          usedHours: data.usedHours || 0,
          price: data.price,
          expiresAt: data.expiresAt?.toDate(),
          expiryDays: data.expiryDays,
          active: data.active,
          sharedAcrossUnits: data.sharedAcrossUnits ?? true,
          unitId: data.unitId || '',
          paymentId: data.paymentId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        if (data.customer) {
          pkg.customer = {
            id: data.customer.id || '',
            name: data.customer.name || '',
            phone: data.customer.phone || '',
            email: data.customer.email,
            cpf: data.customer.cpf,
            address: data.customer.address,
            createdAt: data.customer.createdAt?.toDate?.() || new Date(),
            updatedAt: data.customer.updatedAt?.toDate?.() || new Date(),
          };
        }

        if (pkg.usedHours < pkg.hours) {
          packages.push(pkg);
        }
      }

      // Salva em paralelo
      await Promise.all(packages.map(pkg => 
        syncService.saveLocally(COLLECTION, 'create', pkg).catch(() => {})
      ));

      return packages.filter(pkg => !customerId || pkg.customerId === customerId);
    } catch (error) {
      console.error('Error in getActivePackages:', error);
      return [];
    }
  },
};
