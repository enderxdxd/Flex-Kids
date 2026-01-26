"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packagesService = void 0;
const firestore_1 = require("firebase/firestore");
const config_1 = require("../config");
const COLLECTION = 'packages';
exports.packagesService = {
    async createPackage(data) {
        const db = (0, config_1.getDb)();
        const packageData = {
            ...data,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
            expiresAt: data.expiresAt ? firestore_1.Timestamp.fromDate(data.expiresAt) : null,
        };
        const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, COLLECTION), packageData);
        return {
            id: docRef.id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    async updatePackage(id, data) {
        const db = (0, config_1.getDb)();
        const packageRef = (0, firestore_1.doc)(db, COLLECTION, id);
        const updateData = {
            ...data,
            updatedAt: firestore_1.Timestamp.now(),
        };
        if (data.expiresAt) {
            updateData.expiresAt = firestore_1.Timestamp.fromDate(data.expiresAt);
        }
        await (0, firestore_1.updateDoc)(packageRef, updateData);
    },
    async usePackageHours(id, hours) {
        const db = (0, config_1.getDb)();
        const packageRef = (0, firestore_1.doc)(db, COLLECTION, id);
        const snapshot = await (0, firestore_1.getDocs)((0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('__name__', '==', id)));
        if (!snapshot.empty) {
            const currentUsed = snapshot.docs[0].data().usedHours || 0;
            await (0, firestore_1.updateDoc)(packageRef, {
                usedHours: currentUsed + hours,
                updatedAt: firestore_1.Timestamp.now(),
            });
        }
    },
    async deactivatePackage(id) {
        const db = (0, config_1.getDb)();
        const packageRef = (0, firestore_1.doc)(db, COLLECTION, id);
        await (0, firestore_1.updateDoc)(packageRef, {
            active: false,
            updatedAt: firestore_1.Timestamp.now(),
        });
    },
    async getPackagesByCustomer(customerId) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('customerId', '==', customerId), (0, firestore_1.orderBy)('createdAt', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
            expiresAt: doc.data().expiresAt?.toDate(),
        }));
    },
    async getActivePackages(customerId) {
        const db = (0, config_1.getDb)();
        let q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('active', '==', true), (0, firestore_1.orderBy)('createdAt', 'desc'));
        if (customerId) {
            q = (0, firestore_1.query)(q, (0, firestore_1.where)('customerId', '==', customerId));
        }
        const snapshot = await (0, firestore_1.getDocs)(q);
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
            if (!pkg.expiresAt)
                return true;
            return pkg.expiresAt > now;
        });
    },
};
