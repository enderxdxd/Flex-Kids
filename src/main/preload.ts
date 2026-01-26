import { contextBridge } from 'electron';

// Simplified preload - Firebase is accessed directly from renderer process
// No IPC needed for this architecture

const api = {};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

contextBridge.exposeInMainWorld('api', api);

export type ElectronAPI = typeof api;
