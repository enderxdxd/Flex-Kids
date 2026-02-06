import { contextBridge, ipcRenderer } from 'electron';

console.log('[PRELOAD] ====================================');
console.log('[PRELOAD] Preload script carregado!');
console.log('[PRELOAD] ====================================');

// API para comunicação com impressora via IPC
const printerAPI = {
  listPorts: () => ipcRenderer.invoke('printer:list-ports'),
  connect: (portPath: string, baudRate?: number) => ipcRenderer.invoke('printer:connect', portPath, baudRate),
  disconnect: () => ipcRenderer.invoke('printer:disconnect'),
  sendCommand: (command: string) => ipcRenderer.invoke('printer:send-command', command),
  sendRaw: (data: number[]) => ipcRenderer.invoke('printer:send-raw', data),
  getStatus: () => ipcRenderer.invoke('printer:status'),
  printText: (text: string) => ipcRenderer.invoke('printer:print-text', text),
  printTest: (portPath: string) => ipcRenderer.invoke('printer:print-test', portPath),
  getLogs: () => ipcRenderer.invoke('printer:get-logs'),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    },
    printer: printerAPI,
  });
  console.log('[PRELOAD] ✅ electronAPI exposto com sucesso');
} catch (error) {
  console.error('[PRELOAD] ❌ Erro ao expor electronAPI:', error);
}

export type PrinterAPI = typeof printerAPI;
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  printer: PrinterAPI;
}
