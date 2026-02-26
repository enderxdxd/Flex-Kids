import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win;

  // Configuração
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Logs
  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] Verificando atualizações...');
    sendToRenderer('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[UPDATER] Atualização disponível:', info.version);
    sendToRenderer('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] Nenhuma atualização disponível');
    sendToRenderer('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[UPDATER] Download: ${Math.round(progress.percent)}%`);
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[UPDATER] Atualização baixada, pronta para instalar');
    sendToRenderer('update-status', { status: 'downloaded' });
  });

  autoUpdater.on('error', (error) => {
    console.error('[UPDATER] Erro:', error.message);
    sendToRenderer('update-status', { status: 'error', message: error.message });
  });

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:get-version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });

  // Verifica atualizações ao iniciar (após 10s)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[UPDATER] Erro na verificação inicial:', err.message);
    });
  }, 10_000);
}

function sendToRenderer(channel: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
