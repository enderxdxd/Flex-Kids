"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersService = void 0;
const firestore_1 = require("firebase/firestore");
const config_1 = require("../config");
const CUSTOMERS_COLLECTION = 'customers';
const CHILDREN_COLLECTION = 'children';
exports.customersService = {
    async createCustomer(data) {
        const db = (0, config_1.getDb)();
        const customerData = {
            ...data,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, CUSTOMERS_COLLECTION), customerData);
        return {
            id: docRef.id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    async updateCustomer(id, data) {
        const db = (0, config_1.getDb)();
        const customerRef = (0, firestore_1.doc)(db, CUSTOMERS_COLLECTION, id);
        await (0, firestore_1.updateDoc)(customerRef, {
            ...data,
            updatedAt: firestore_1.Timestamp.now(),
        });
    },
    async deleteCustomer(id) {
        const db = (0, config_1.getDb)();
        const customerRef = (0, firestore_1.doc)(db, CUSTOMERS_COLLECTION, id);
        await (0, firestore_1.deleteDoc)(customerRef);
    },
    async getCustomer(id) {
        const db = (0, config_1.getDb)();
        const customerRef = (0, firestore_1.doc)(db, CUSTOMERS_COLLECTION, id);
        const snapshot = await (0, firestore_1.getDoc)(customerRef);
        if (!snapshot.exists())
            return null;
        return {
            id: snapshot.id,
            ...snapshot.data(),
            createdAt: snapshot.data().createdAt?.toDate(),
            updatedAt: snapshot.data().updatedAt?.toDate(),
        };
    },
    async getAllCustomers() {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, CUSTOMERS_COLLECTION), (0, firestore_1.orderBy)('name'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async searchCustomers(searchTerm) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, CUSTOMERS_COLLECTION));
        const snapshot = await (0, firestore_1.getDocs)(q);
        const term = searchTerm.toLowerCase();
        return snapshot.docs
            .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }))
            .filter(customer => customer.name.toLowerCase().includes(term) ||
            customer.phone.includes(term) ||
            customer.email?.toLowerCase().includes(term));
    },
    async addChild(customerId, childData) {
        const db = (0, config_1.getDb)();
        const data = {
            ...childData,
            customerId,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const docRef = await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, CHILDREN_COLLECTION), data);
        return {
            id: docRef.id,
            ...childData,
            customerId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    },
    async updateChild(id, data) {
        const db = (0, config_1.getDb)();
        const childRef = (0, firestore_1.doc)(db, CHILDREN_COLLECTION, id);
        await (0, firestore_1.updateDoc)(childRef, {
            ...data,
            updatedAt: firestore_1.Timestamp.now(),
        });
    },
    async deleteChild(id) {
        const db = (0, config_1.getDb)();
        const childRef = (0, firestore_1.doc)(db, CHILDREN_COLLECTION, id);
        await (0, firestore_1.deleteDoc)(childRef);
    },
    async getChildrenByCustomer(customerId) {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, CHILDREN_COLLECTION), (0, firestore_1.where)('customerId', '==', customerId), (0, firestore_1.orderBy)('name'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
    async getAllChildren() {
        const db = (0, config_1.getDb)();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, CHILDREN_COLLECTION), (0, firestore_1.orderBy)('name'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        }));
    },
};
