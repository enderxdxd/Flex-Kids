import { collection, doc, getDoc, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Settings, FiscalConfig } from '../../types';
import { syncService } from '../../database/syncService';

const COLLECTION = 'settings';

export const settingsServiceOffline = {
  async getSettings(): Promise<{ hourlyRate: number; minimumTime: number; pixKey: string }> {
    try {
      const [hourlyRate, minimumTime, pixKey] = await Promise.all([
        this.getHourlyRate(),
        this.getMinimumTime(),
        this.getPixKey(),
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
      await syncService.saveLocally(COLLECTION, 'create', {
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

    if (syncService.isOnline()) {
      try {
        const db = getDb();
        const settingRef = doc(db, COLLECTION, key);
        
        await setDoc(settingRef, {
          key,
          value,
          updatedAt: Timestamp.now(),
        }, { merge: true });

        await syncService.saveLocally(COLLECTION, 'update', settingData);
        return;
      } catch (error) {
        console.error('Failed to save to Firebase, saving locally:', error);
      }
    }

    await syncService.saveLocally(COLLECTION, 'update', settingData);
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
        syncService.saveLocally(COLLECTION, 'create', setting).catch(() => {})
      ));
    } catch (error) {
      console.error('Background refresh failed (non-blocking):', error);
    }
  },

  async getHourlyRate(): Promise<number> {
    const value = await this.getSetting('hourlyRate');
    return value ? parseFloat(value) : 30.0;
  },

  async setHourlyRate(rate: number): Promise<void> {
    await this.setSetting('hourlyRate', rate.toString());
  },

  async getMinimumTime(): Promise<number> {
    const value = await this.getSetting('minimumTime');
    return value ? parseInt(value) : 30;
  },

  async setMinimumTime(minutes: number): Promise<void> {
    await this.setSetting('minimumTime', minutes.toString());
  },

  async getPixKey(): Promise<string | null> {
    return await this.getSetting('pixKey');
  },

  async setPixKey(key: string): Promise<void> {
    await this.setSetting('pixKey', key);
  },

  async getFiscalConfig(): Promise<FiscalConfig | null> {
    try {
      const configStr = await this.getSetting('fiscalConfig');
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

  async saveFiscalConfig(config: Omit<FiscalConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const fiscalConfig: FiscalConfig = {
        id: 'fiscalConfig',
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.setSetting('fiscalConfig', JSON.stringify(fiscalConfig));
    } catch (error) {
      console.error('Error saving fiscal config:', error);
      throw error;
    }
  },
};
