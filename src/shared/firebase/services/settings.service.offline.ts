import { collection, doc, getDoc, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Settings, FiscalConfig } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'settings';

export const settingsServiceOffline = {
  async getSettings(unitId?: string): Promise<{ hourlyRate: number; minimumTime: number; pixKey: string }> {
    try {
      const [hourlyRate, minimumTime, pixKey] = await Promise.all([
        this.getHourlyRate(unitId),
        this.getMinimumTime(unitId),
        this.getPixKey(unitId),
      ]);
      return { hourlyRate, minimumTime, pixKey };
    } catch (error) {
      console.error('Error getting settings:', error);
      return { hourlyRate: 30, minimumTime: 30, pixKey: '' };
    }
  },

  async getSetting(key: string): Promise<string | null> {
    try {
      // 1. Busca do cache local primeiro
      const localSettings = await syncService.getAllFromLocal(COLLECTION);
      const cached = localSettings.find((s: Settings) => s.key === key);
      
      // 2. Se offline, retorna cache (ou null)
      if (!syncService.isOnline()) {
        return cached ? cached.value : null;
      }

      // 3. SEMPRE retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline() && !cached) {
        // Só busca do Firebase em background se não tem no cache
        this.fetchSettingFromFirebase(key).catch(err => 
          console.error('Background fetch failed:', err)
        );
      }
      
      return cached ? cached.value : null;
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  },

  async fetchSettingFromFirebase(key: string): Promise<string | null> {
    try {
      const db = getDb();
      const settingRef = doc(db, COLLECTION, key);
      const snapshot = await getDoc(settingRef);
      
      if (!snapshot.exists()) return null;
      
      const value = snapshot.data().value;
      
      // Salva no cache
      await syncService.saveToCacheOnly(COLLECTION, {
        id: key,
        key,
        value,
        createdAt: snapshot.data().createdAt?.toDate() || new Date(),
        updatedAt: snapshot.data().updatedAt?.toDate() || new Date(),
      });
      
      return value;
    } catch (error) {
      console.error('Error fetching setting from Firebase:', error);
      return null;
    }
  },

  async setSetting(key: string, value: string): Promise<void> {
    const settingData = {
      id: key,
      key,
      value,
      updatedAt: new Date(),
    };

    // Salva no cache local primeiro (garante que nunca trava)
    await syncService.saveToCacheOnly(COLLECTION, settingData);

    // Tenta salvar no Firebase em background (não bloqueia, não entra na sync queue)
    if (syncService.isOnline()) {
      const firebaseSave = async () => {
        try {
          const db = getDb();
          const settingRef = doc(db, COLLECTION, key);
          
          const firebasePromise = setDoc(settingRef, {
            key,
            value,
            updatedAt: Timestamp.now(),
          }, { merge: true });

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase save timeout')), 5000)
          );

          await Promise.race([firebasePromise, timeoutPromise]);
        } catch (error) {
          console.warn(`[Settings] Firebase save failed for "${key}" (saved locally):`, error);
        }
      };
      // Fire and forget - don't block the UI
      firebaseSave();
    }
  },

  async getAllSettings(): Promise<Settings[]> {
    try {
      // 1. Busca do cache primeiro
      const localSettings = await syncService.getAllFromLocal(COLLECTION);
      
      // 2. Se offline, retorna cache
      if (!syncService.isOnline()) {
        return localSettings as Settings[];
      }

      // 3. SEMPRE retorna cache primeiro e busca Firebase em background
      if (syncService.isOnline()) {
        this.refreshSettingsInBackground().catch(err => 
          console.error('Background refresh failed:', err)
        );
      }

      return localSettings as Settings[];
    } catch (error) {
      console.error('Error getting all settings:', error);
      return [];
    }
  },

  async refreshSettingsInBackground(): Promise<void> {
    try {
      const db = getDb();
      const snapshot = await getDocs(collection(db, COLLECTION));
      
      const settings = snapshot.docs.map(doc => ({
        id: doc.id,
        key: doc.data().key,
        value: doc.data().value,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Settings[];

      await Promise.all(settings.map(setting => 
        syncService.saveToCacheOnly(COLLECTION, setting).catch(() => {})
      ));
    } catch (error) {
      console.error('Background refresh failed (non-blocking):', error);
    }
  },

  // Helper: build unit-scoped key
  _unitKey(base: string, unitId?: string): string {
    return unitId ? `${base}_${unitId}` : base;
  },

  // Helper: get setting with unit fallback (tries unit-specific first, then global)
  async _getSettingWithFallback(base: string, unitId?: string): Promise<string | null> {
    if (unitId) {
      const unitValue = await this.getSetting(`${base}_${unitId}`);
      if (unitValue !== null) return unitValue;
    }
    // Fallback to global (migration support)
    return await this.getSetting(base);
  },

  async getHourlyRate(unitId?: string): Promise<number> {
    const value = await this._getSettingWithFallback('hourlyRate', unitId);
    return value ? parseFloat(value) : 30.0;
  },

  async setHourlyRate(rate: number, unitId?: string): Promise<void> {
    await this.setSetting(this._unitKey('hourlyRate', unitId), rate.toString());
  },

  async getMinimumTime(unitId?: string): Promise<number> {
    const value = await this._getSettingWithFallback('minimumTime', unitId);
    return value ? parseInt(value) : 30;
  },

  async setMinimumTime(minutes: number, unitId?: string): Promise<void> {
    await this.setSetting(this._unitKey('minimumTime', unitId), minutes.toString());
  },

  async getPixKey(unitId?: string): Promise<string | null> {
    return await this._getSettingWithFallback('pixKey', unitId);
  },

  async setPixKey(key: string, unitId?: string): Promise<void> {
    await this.setSetting(this._unitKey('pixKey', unitId), key);
  },

  async getFiscalConfig(unitId?: string): Promise<FiscalConfig | null> {
    try {
      const configStr = await this._getSettingWithFallback('fiscalConfig', unitId);
      if (!configStr) return null;
      
      const config = JSON.parse(configStr);
      return {
        ...config,
        createdAt: new Date(config.createdAt),
        updatedAt: new Date(config.updatedAt),
      } as FiscalConfig;
    } catch (error) {
      console.error('Error getting fiscal config:', error);
      return null;
    }
  },

  async saveFiscalConfig(config: Omit<FiscalConfig, 'id' | 'createdAt' | 'updatedAt'>, unitId?: string): Promise<void> {
    try {
      const fiscalConfig: FiscalConfig = {
        id: 'fiscalConfig',
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.setSetting(this._unitKey('fiscalConfig', unitId), JSON.stringify(fiscalConfig));
    } catch (error) {
      console.error('Error saving fiscal config:', error);
      throw error;
    }
  },

  async getPackagePlans(unitId?: string): Promise<{ name: string; hours: number; price: number; expiryDays: number }[]> {
    try {
      const plansStr = await this._getSettingWithFallback('packagePlans', unitId);
      if (!plansStr) {
        return [
          { name: 'Pacote 5h', hours: 5, price: 150, expiryDays: 30 },
          { name: 'Pacote 10h', hours: 10, price: 300, expiryDays: 30 },
          { name: 'Pacote 20h', hours: 20, price: 550, expiryDays: 60 },
          { name: 'Pacote 30h', hours: 30, price: 800, expiryDays: 90 },
        ];
      }
      return JSON.parse(plansStr);
    } catch (error) {
      console.error('Error getting package plans:', error);
      return [];
    }
  },

  async savePackagePlans(plans: { name: string; hours: number; price: number; expiryDays: number }[], unitId?: string): Promise<void> {
    await this.setSetting(this._unitKey('packagePlans', unitId), JSON.stringify(plans));
  },
};
