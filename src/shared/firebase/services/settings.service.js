"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = void 0;
const firestore_1 = require("firebase/firestore");
const config_1 = require("../config");
const COLLECTION = 'settings';
exports.settingsService = {
    async getSetting(key) {
        const db = (0, config_1.getDb)();
        const settingRef = (0, firestore_1.doc)(db, COLLECTION, key);
        const snapshot = await (0, firestore_1.getDoc)(settingRef);
        if (!snapshot.exists())
            return null;
        return snapshot.data().value;
    },
    async setSetting(key, value) {
        const db = (0, config_1.getDb)();
        const settingRef = (0, firestore_1.doc)(db, COLLECTION, key);
        await (0, firestore_1.setDoc)(settingRef, {
            key,
            value,
            updatedAt: firestore_1.Timestamp.now(),
        }, { merge: true });
    },
    async getAllSettings() {
        const db = (0, config_1.getDb)();
        const snapshot = await (0, firestore_1.getDocs)((0, firestore_1.collection)(db, COLLECTION));
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async getHourlyRate() {
        const value = await this.getSetting('hourlyRate');
        return value ? parseFloat(value) : 30.0;
    },
    async setHourlyRate(rate) {
        await this.setSetting('hourlyRate', rate.toString());
    },
    async getMinimumTime() {
        const value = await this.getSetting('minimumTime');
        return value ? parseInt(value) : 30;
    },
    async setMinimumTime(minutes) {
        await this.setSetting('minimumTime', minutes.toString());
    },
    async getPixKey() {
        return await this.getSetting('pixKey');
    },
    async setPixKey(key) {
        await this.setSetting('pixKey', key);
    },
};
