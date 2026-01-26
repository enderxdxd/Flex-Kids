"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseAnalytics = exports.getFirebaseAuth = exports.getDb = exports.getFirebaseApp = void 0;
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const auth_1 = require("firebase/auth");
const analytics_1 = require("firebase/analytics");
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
let app;
let db;
let auth;
let analytics;
const getFirebaseApp = () => {
    if (!app) {
        app = (0, app_1.initializeApp)(firebaseConfig);
    }
    return app;
};
exports.getFirebaseApp = getFirebaseApp;
const getDb = () => {
    if (!db) {
        db = (0, firestore_1.getFirestore)((0, exports.getFirebaseApp)());
    }
    return db;
};
exports.getDb = getDb;
const getFirebaseAuth = () => {
    if (!auth) {
        auth = (0, auth_1.getAuth)((0, exports.getFirebaseApp)());
    }
    return auth;
};
exports.getFirebaseAuth = getFirebaseAuth;
const getFirebaseAnalytics = () => {
    if (!analytics && typeof window !== 'undefined') {
        analytics = (0, analytics_1.getAnalytics)((0, exports.getFirebaseApp)());
    }
    return analytics;
};
exports.getFirebaseAnalytics = getFirebaseAnalytics;
