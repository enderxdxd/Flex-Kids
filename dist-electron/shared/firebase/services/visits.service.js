"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitsService = void 0;
const firestore_1 = require("firebase/firestore");
const config_1 = require("../config");
const COLLECTION = 'visits';
exports.visitsService = {
    async checkIn(data) {
        const db = (0, config_1.getDb)();
        const visitData = {
            childId: data.childId,
            unitId: data.unitId,
            checkIn: firestore_1.Timestamp.now(),
            checkOut: null,
            duration: null,
            value: null,
            paid: false,
            paymentId: null,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, COLLECTION), visitData);
        return {
            id: docRef.id,
            ...visitData,
            checkIn: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    async checkOut(data) {
        const db = (0, config_1.getDb)();
        const visitRef = (0, firestore_1.doc)(db, COLLECTION, data.visitId);
        const checkOutTime = firestore_1.Timestamp.now();
        await (0, firestore_1.updateDoc)(visitRef, {
            checkOut: checkOutTime,
            updatedAt: firestore_1.Timestamp.now(),
        });
        return { id: data.visitId };
    },
    async getActiveVisits(unitId) {
        const db = (0, config_1.getDb)();
        let q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('checkOut', '==', null), (0, firestore_1.orderBy)('checkIn', 'desc'));
        if (unitId) {
            q = (0, firestore_1.query)(q, (0, firestore_1.where)('unitId', '==', unitId));
        }
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            checkIn: doc.data().checkIn?.toDate(),
            checkOut: doc.data().checkOut?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async getVisitsByChild(childId) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('childId', '==', childId), (0, firestore_1.orderBy)('checkIn', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            checkIn: doc.data().checkIn?.toDate(),
            checkOut: doc.data().checkOut?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async updateVisitPayment(visitId, paymentId, value) {
        const db = (0, config_1.getDb)();
        const visitRef = (0, firestore_1.doc)(db, COLLECTION, visitId);
        await (0, firestore_1.updateDoc)(visitRef, {
            paymentId,
            value,
            paid: true,
            updatedAt: firestore_1.Timestamp.now(),
        });
    },
};
