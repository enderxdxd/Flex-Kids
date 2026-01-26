import { collection, doc, getDoc, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { Settings } from '../../types';

const COLLECTION = 'settings';

export const settingsService = {
  async getSetting(key: string): Promise<string | null> {
    const db = getDb();
    const settingRef = doc(db, COLLECTION, key);
    const snapshot = await getDoc(settingRef);
    
    if (!snapshot.exists()) return null;
    return snapshot.data().value;
  },

  async setSetting(key: string, value: string): Promise<void> {
    const db = getDb();
    const settingRef = doc(db, COLLECTION, key);
    
    await setDoc(settingRef, {
      key,
      value,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  },

  async getAllSettings(): Promise<Settings[]> {
    const db = getDb();
    const snapshot = await getDocs(collection(db, COLLECTION));
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Settings[];
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
};
