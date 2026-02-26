import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerPrinterIPC } from './printer.service';
import { registerUpdaterIPC, initAutoUpdater } from './updater';

// Log para debug - vai aparecer no terminal/arquivo de log
console.log('[MAIN] ====================================');
console.log('[MAIN] Iniciando Flex-Kids Manager...');
console.log('[MAIN] __dirname:', __dirname);
console.log('[MAIN] ====================================');

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[MAIN] Preload path:', preloadPath);
  
  // Verifica se o arquivo existe
  const fs = require('fs');
  if (fs.existsSync(preloadPath)) {
    console.log('[MAIN] ✅ Arquivo preload.js encontrado');
  } else {
    console.error('[MAIN] ❌ Arquivo preload.js NÃO encontrado!');
  }
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('[MAIN] App ready, registrando IPC handlers...');
  
  // Registra IPC handlers para impressora
  try {
    registerPrinterIPC();
    console.log('[MAIN] IPC handlers registrados com sucesso');
  } catch (error) {
    console.error('[MAIN] ERRO ao registrar IPC handlers:', error);
  }

  // Registra IPC handlers do updater ANTES de criar a janela
  registerUpdaterIPC();
  console.log('[MAIN] Updater IPC handlers registrados');
  
  createWindow();

  // Inicializa listeners do auto-updater (precisa de mainWindow)
  if (mainWindow) {
    try {
      initAutoUpdater(mainWindow);
      console.log('[MAIN] Auto-updater inicializado');
    } catch (error) {
      console.error('[MAIN] ERRO ao inicializar auto-updater:', error);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
