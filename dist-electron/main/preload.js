"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Simplified preload - Firebase is accessed directly from renderer process
// No IPC needed for this architecture
const api = {};
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    },
});
electron_1.contextBridge.exposeInMainWorld('api', api);
