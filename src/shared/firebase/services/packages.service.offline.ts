import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { getDocsSafe, setDocSafe, updateDocSafe, isFirebaseConnectivityError } from '../firebaseHelpers';
import { Package } from '../../types';
import { syncService } from '../../database/syncService';
import { settingsServiceOffline } from './settings.service.offline';
import { isPackageUsable as isPackageUsableShared, PackagePlanLike } from '../../utils/packageExpiry';

const COLLECTION = 'packages';

let _createLock = false;

/**
 * Carrega os planos da unidade para resolver a validade de pacotes legados
 * (sem expiryDays) por correspondência de horas. Nunca lança — em caso de
 * falha retorna [] e o cálculo de validade cai no expiresAt/null.
 */
async function loadPlans(unitId?: string): Promise<PackagePlanLike[]> {
  try {
    return await settingsServiceOffline.getPackagePlans(unitId);
  } catch {
    return [];
  }
}

export const packagesServiceOffline = {
  async createPackage(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    if (_createLock) {
      throw new Error('Criação de pacote já em andamento, aguarde.');
    }
    _createLock = true;

    try {
      return await this._doCreatePackage(data);
    } finally {
      setTimeout(() => { _createLock = false; }, 2000);
    }
  },

  async _doCreatePackage(data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>): Promise<Package> {
    const db = getDb();
    const packageRef = doc(collection(db, COLLECTION));
    const packageData = {
      id: packageRef.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (syncService.isOnline()) {
      try {
        const firestoreData: Record<string, any> = {
          ...data,
          sharedAcrossUnits: data.sharedAcrossUnits ?? false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : null,
        };
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        await setDocSafe(packageRef, firestoreData);
        const pkg = {
          ...packageData,
        };

        await syncService.saveToCacheOnly(COLLECTION, pkg);
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
        
        const firestoreData: Record<string, any> = {
          ...data,
          updatedAt: Timestamp.now(),
        };

        if (data.expiresAt) {
          firestoreData.expiresAt = Timestamp.fromDate(data.expiresAt);
        }
        if (data.createdAt) {
          firestoreData.createdAt = Timestamp.fromDate(data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt));
        }
        Object.keys(firestoreData).forEach(k => firestoreData[k] === undefined && delete firestoreData[k]);

        await updateDocSafe(packageRef, firestoreData);
        
        const localPkg = await syncService.getFromLocal(COLLECTION, id);
        await syncService.saveToCacheOnly(COLLECTION, { ...localPkg, ...updateData });
        return;
      } catch (error) {
        console.error('Failed to update in Firebase, saving locally:', error);
      }
    }

    const localPkg = await syncService.getFromLocal(COLLECTION, id);
    await syncService.saveLocally(COLLECTION, 'update', { ...localPkg, ...updateData });
  },

  async deletePackage(id: string): Promise<void> {
    const softDeleteData = { deletedAt: new Date(), updatedAt: new Date() };

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        await updateDocSafe(doc(db, COLLECTION, id), {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const existing = await syncService.getFromLocal(COLLECTION, id);
        if (existing) {
          await syncService.saveToCacheOnly(COLLECTION, { ...existing, ...softDeleteData });
        }
        return;
      } catch (error) {
        console.error('Failed to soft-delete package in Firebase, queuing for sync:', error);
      }
    }

    const existing = await syncService.getFromLocal(COLLECTION, id);
    if (existing) {
      await syncService.saveLocally(COLLECTION, 'update', { ...existing, ...softDeleteData });
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

        const snapshot = await getDocsSafe(q);
        const packages: any[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            expiresAt: data.expiresAt?.toDate(),
            deletedAt: data.deletedAt?.toDate() || null,
          };
        });

        await syncService.bulkSaveToCacheOnly(COLLECTION, packages);

        return packages.filter(p => !p.deletedAt) as Package[];
      } catch (error) {
        if (!isFirebaseConnectivityError(error)) console.error('Failed to fetch packages by customer:', error);
      }
    }

    const allPackages = await syncService.getAllFromLocal(COLLECTION);
    return allPackages.filter((pkg: Package) => pkg.customerId === customerId);
  },

  async getAllPackages(unitId?: string): Promise<Package[]> {
    try {
      const localPackages = unitId
        ? await syncService.getAllFromLocalByUnit(COLLECTION, unitId) as Package[]
        : await syncService.getAllFromLocal(COLLECTION) as Package[];

      if (syncService.isOnline()) {
        this.fetchAllPackagesFromFirebase(unitId)
          .then(fbPackages => {
            if (typeof window !== 'undefined' && fbPackages.length > 0) {
              window.dispatchEvent(new CustomEvent('packages-updated', {
                detail: { packages: fbPackages }
              }));
            }
          })
          .catch(err => {
            if (!isFirebaseConnectivityError(err)) console.error('Background fetchAll packages failed:', err);
          });

        if (localPackages.length === 0) {
          try {
            return await this.fetchAllPackagesFromFirebase(unitId);
          } catch {
            return [];
          }
        }
      }

      return localPackages;
    } catch (error) {
      console.error('Error getting all packages:', error);
      return [];
    }
  },

  async fetchAllPackagesFromFirebase(unitId?: string): Promise<Package[]> {
    try {
      const db = getDb();
      const constraints: any[] = [];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('createdAt', 'desc'));
      const q = query(collection(db, COLLECTION), ...constraints);

      const snapshot = await getDocsSafe(q);
      const packages: Package[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.deletedAt) continue;

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
          sharedAcrossUnits: data.sharedAcrossUnits ?? false,
          unitId: data.unitId || unitId || '',
          paymentId: data.paymentId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        packages.push(pkg);
      }

      await syncService.bulkSaveToCacheOnly(COLLECTION, packages);
      return packages;
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error fetching all packages from Firebase:', error);
      return [];
    }
  },

  async usePackage(packageId: string, hoursUsed: number): Promise<void> {
    try {
      const pkg = await syncService.getFromLocal(COLLECTION, packageId);
      if (!pkg) {
        throw new Error('Package not found');
      }

      const availableHours = Math.max(0, (pkg.hours || 0) - (pkg.usedHours || 0));
      if (hoursUsed - availableHours > 0.001) {
        throw new Error('Package does not have enough remaining hours');
      }

      const newUsedHours = Math.min(pkg.hours, (pkg.usedHours || 0) + hoursUsed);
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

  async getActivePackages(customerId?: string, unitId?: string): Promise<Package[]> {
    try {
      const [localPackages, plans] = await Promise.all([
        unitId
          ? syncService.getAllFromLocalByUnit(COLLECTION, unitId) as Promise<Package[]>
          : syncService.getAllFromLocal(COLLECTION) as Promise<Package[]>,
        loadPlans(unitId),
      ]);
      const cachedPackages = localPackages
        .filter((pkg: Package) => {
          const matchesCustomer = !customerId || pkg.customerId === customerId;
          return matchesCustomer && isPackageUsableShared(pkg, plans);
        })
        .sort((a: Package, b: Package) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

      if (!syncService.isOnline()) {
        return cachedPackages;
      }

      if (cachedPackages.length === 0) {
        try {
          return await this.fetchActivePackagesFromFirebase(customerId, unitId);
        } catch {
          return [];
        }
      }

      this.fetchActivePackagesFromFirebase(customerId, unitId)
        .then(packages => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('packages-updated', { 
              detail: { packages, customerId } 
            }));
          }
        })
        .catch(err => {
          if (!isFirebaseConnectivityError(err)) console.error('Background fetch failed:', err);
        });
      
      return cachedPackages;
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error in getActivePackages:', error);
      return [];
    }
  },

  async fetchActivePackagesFromFirebase(customerId?: string, unitId?: string): Promise<Package[]> {
    try {
      const db = getDb();
      const plans = await loadPlans(unitId);
      const constraints: any[] = [where('active', '==', true)];
      if (unitId) {
        constraints.push(where('unitId', '==', unitId));
      }
      constraints.push(orderBy('createdAt', 'desc'));
      const q = query(collection(db, COLLECTION), ...constraints);

      const snapshot = await getDocsSafe(q);

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
          sharedAcrossUnits: data.sharedAcrossUnits ?? false,
          unitId: data.unitId || unitId || '',
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

        if (isPackageUsableShared(pkg, plans)) {
          packages.push(pkg);
        }
      }

      await syncService.bulkSaveToCacheOnly(COLLECTION, packages);

      return packages.filter(pkg => !customerId || pkg.customerId === customerId);
    } catch (error) {
      if (!isFirebaseConnectivityError(error)) console.error('Error in getActivePackages:', error);
      return [];
    }
  },
};
