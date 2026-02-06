/**
 * Serviço de impressão Bematech - Main Process
 * Este serviço roda no main process do Electron onde o serialport funciona
 */

import { ipcMain } from 'electron';

let SerialPort: any = null;
let port: any = null;
let isConnected = false;

// Tenta importar serialport
try {
  console.log('[PRINTER] Tentando carregar serialport...');
  const sp = require('serialport');
  console.log('[PRINTER] Módulo serialport carregado:', Object.keys(sp));
  SerialPort = sp.SerialPort;
  console.log('[PRINTER] ✅ SerialPort class disponível:', !!SerialPort);
} catch (e: any) {
  console.error('[PRINTER] ❌ Erro ao carregar SerialPort:', e.message);
  console.error('[PRINTER] Stack:', e.stack);
}

/**
 * Lista todas as portas seriais disponíveis
 */
async function listPorts(): Promise<any[]> {
  if (!SerialPort) {
    console.error('SerialPort não disponível');
    return [];
  }
  
  try {
    const ports = await SerialPort.list();
    console.log('Portas encontradas:', ports);
    return ports;
  } catch (error) {
    console.error('Erro ao listar portas:', error);
    return [];
  }
}

/**
 * Conecta à impressora na porta especificada
 */
async function connect(portPath: string, baudRate: number = 9600): Promise<boolean> {
  if (!SerialPort) {
    console.error('SerialPort não disponível');
    return false;
  }

  try {
    // Fecha porta anterior se existir
    if (port && port.isOpen) {
      await new Promise<void>((resolve) => {
        port.close(() => resolve());
      });
    }

    // Abre nova conexão
    port = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false,
    });

    // Abre a porta
    await new Promise<void>((resolve, reject) => {
      port.open((err: any) => {
        if (err) {
          console.error('Erro ao abrir porta:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    isConnected = true;
    console.log(`✅ Conectado à impressora na porta ${portPath}`);
    return true;
  } catch (error) {
    console.error('Erro ao conectar:', error);
    isConnected = false;
    return false;
  }
}

/**
 * Desconecta da impressora
 */
async function disconnect(): Promise<void> {
  if (port && port.isOpen) {
    await new Promise<void>((resolve) => {
      port.close(() => {
        console.log('Porta serial fechada');
        resolve();
      });
    });
    port = null;
  }
  isConnected = false;
}

/**
 * Envia comando para a impressora com drain (flush)
 */
async function sendCommand(command: string): Promise<boolean> {
  console.log('[PRINTER] sendCommand chamado, porta aberta:', port?.isOpen);
  
  if (!port || !port.isOpen) {
    console.error('[PRINTER] Porta não está aberta');
    return false;
  }

  return new Promise((resolve) => {
    // Converte para Buffer para garantir encoding correto
    const buffer = Buffer.from(command, 'latin1');
    console.log('[PRINTER] Escrevendo', buffer.length, 'bytes na porta...');
    
    port.write(buffer, (err: any) => {
      if (err) {
        console.error('[PRINTER] Erro ao escrever:', err);
        resolve(false);
        return;
      }
      
      // Aguarda o buffer ser enviado fisicamente
      port.drain((drainErr: any) => {
        if (drainErr) {
          console.error('[PRINTER] Erro no drain:', drainErr);
          resolve(false);
        } else {
          console.log('[PRINTER] ✅ Dados enviados e flush completo');
          resolve(true);
        }
      });
    });
  });
}

/**
 * Envia dados raw (Buffer) para a impressora
 */
async function sendRaw(data: number[]): Promise<boolean> {
  if (!port || !port.isOpen) {
    console.error('Porta não está aberta');
    return false;
  }

  const buffer = Buffer.from(data);
  return new Promise((resolve) => {
    port.write(buffer, (err: any) => {
      if (err) {
        console.error('Erro ao enviar dados:', err);
        resolve(false);
      } else {
        console.log(`Dados enviados: ${buffer.length} bytes`);
        resolve(true);
      }
    });
  });
}

/**
 * Verifica status da conexão
 */
function getStatus(): { connected: boolean; portOpen: boolean; serialportAvailable: boolean } {
  return {
    connected: isConnected,
    portOpen: port?.isOpen || false,
    serialportAvailable: SerialPort !== null,
  };
}

/**
 * Imprime texto simples usando ESC/POS (compatível com MP-4200 TH)
 */
async function printText(text: string): Promise<boolean> {
  console.log('[PRINTER] ========== printText ==========');
  console.log('[PRINTER] Texto a imprimir:', text.substring(0, 100) + '...');
  console.log('[PRINTER] Porta aberta:', port?.isOpen);
  console.log('[PRINTER] isConnected:', isConnected);
  
  if (!port || !port.isOpen) {
    console.error('[PRINTER] ❌ Porta não está aberta!');
    return false;
  }

  try {
    console.log('[PRINTER] 1. Inicializando impressora (ESC @)...');
    const init = await sendCommand('\x1B\x40'); // ESC @ - Inicializa
    if (!init) {
      console.error('[PRINTER] Falha ao inicializar');
      return false;
    }
    
    // Pequena pausa para a impressora processar
    await new Promise(r => setTimeout(r, 100));
    
    console.log('[PRINTER] 2. Enviando texto...');
    const textSent = await sendCommand(text);
    if (!textSent) {
      console.error('[PRINTER] Falha ao enviar texto');
      return false;
    }
    
    await new Promise(r => setTimeout(r, 100));
    
    console.log('[PRINTER] 3. Avançando papel...');
    await sendCommand('\n\n\n\n\n'); // 5 linhas em branco
    
    await new Promise(r => setTimeout(r, 100));
    
    console.log('[PRINTER] 4. Cortando papel (GS V)...');
    await sendCommand('\x1D\x56\x42\x00'); // GS V B 0 - Corte parcial com feed
    
    console.log('[PRINTER] ✅ Impressão completa!');
    return true;
  } catch (error) {
    console.error('[PRINTER] ❌ Erro ao imprimir:', error);
    return false;
  }
}

/**
 * Registra os handlers IPC para comunicação com o renderer
 */
// Guarda logs para enviar ao renderer
const printerLogs: string[] = [];

function logPrinter(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  printerLogs.push(logMessage);
  console.log('[PRINTER]', message);
}

export function registerPrinterIPC(): void {
  logPrinter('📡 Registrando IPC handlers para impressora...');
  logPrinter(`SerialPort disponível: ${!!SerialPort}`);

  ipcMain.handle('printer:list-ports', async () => {
    return await listPorts();
  });

  ipcMain.handle('printer:connect', async (_event, portPath: string, baudRate?: number) => {
    return await connect(portPath, baudRate);
  });

  ipcMain.handle('printer:disconnect', async () => {
    await disconnect();
    return true;
  });

  ipcMain.handle('printer:send-command', async (_event, command: string) => {
    return await sendCommand(command);
  });

  ipcMain.handle('printer:send-raw', async (_event, data: number[]) => {
    return await sendRaw(data);
  });

  ipcMain.handle('printer:status', () => {
    return getStatus();
  });

  ipcMain.handle('printer:print-text', async (_event, text: string) => {
    return await printText(text);
  });

  // Handler para obter logs do printer service
  ipcMain.handle('printer:get-logs', () => {
    return printerLogs;
  });

  ipcMain.handle('printer:print-test', async (_event, portPath: string) => {
    // Teste completo: conecta, imprime, desconecta
    const connected = await connect(portPath);
    if (!connected) {
      return { success: false, error: 'Não foi possível conectar à porta ' + portPath };
    }

    const lines = [
      '================================',
      '     TESTE DE IMPRESSAO',
      '================================',
      '',
      'Impressora conectada com sucesso!',
      `Porta: ${portPath}`,
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      '',
      '================================',
      '        FLEX-KIDS',
      '================================',
      '',
      '',
      '',
    ];

    const text = lines.join('\n');
    const printed = await printText(text);

    if (!printed) {
      return { success: false, error: 'Erro ao enviar dados para impressora' };
    }

    return { success: true };
  });

  console.log('✅ IPC handlers registrados');
}
