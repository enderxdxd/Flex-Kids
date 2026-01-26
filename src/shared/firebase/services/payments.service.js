"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsService = void 0;
const firestore_1 = require("firebase/firestore");
const config_1 = require("../config");
const COLLECTION = 'payments';
exports.paymentsService = {
    async createPayment(data) {
        const db = (0, config_1.getDb)();
        const paymentData = {
            ...data,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, COLLECTION), paymentData);
        return {
            id: docRef.id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    async updatePaymentStatus(id, status) {
        const db = (0, config_1.getDb)();
        const paymentRef = (0, firestore_1.doc)(db, COLLECTION, id);
        await (0, firestore_1.updateDoc)(paymentRef, {
            status,
            updatedAt: firestore_1.Timestamp.now(),
        });
    },
    async getPaymentsByCustomer(customerId) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('customerId', '==', customerId), (0, firestore_1.orderBy)('createdAt', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async getTodayPayments() {
        const db = (0, config_1.getDb)();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('createdAt', '>=', firestore_1.Timestamp.fromDate(today)), (0, firestore_1.orderBy)('createdAt', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async getPaymentsByDateRange(startDate, endDate) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, COLLECTION), (0, firestore_1.where)('createdAt', '>=', firestore_1.Timestamp.fromDate(startDate)), (0, firestore_1.where)('createdAt', '<=', firestore_1.Timestamp.fromDate(endDate)), (0, firestore_1.orderBy)('createdAt', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
};
