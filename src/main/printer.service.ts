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
 * Envia comando para a impressora
 */
async function sendCommand(command: string): Promise<boolean> {
  if (!port || !port.isOpen) {
    console.error('Porta não está aberta');
    return false;
  }

  return new Promise((resolve) => {
    port.write(command, (err: any) => {
      if (err) {
        console.error('Erro ao enviar comando:', err);
        resolve(false);
      } else {
        console.log(`Comando enviado: ${command.length} bytes`);
        resolve(true);
      }
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
 * Imprime texto simples (para teste)
 */
async function printText(text: string): Promise<boolean> {
  if (!port || !port.isOpen) {
    console.error('Porta não está aberta');
    return false;
  }

  try {
    // Inicializa impressora
    await sendCommand('\x1B\x40'); // ESC @
    
    // Envia texto
    await sendCommand(text);
    
    // Avança papel e corta
    await sendCommand('\n\n\n\n');
    await sendCommand('\x1D\x56\x00'); // GS V 0 - Corte parcial
    
    return true;
  } catch (error) {
    console.error('Erro ao imprimir:', error);
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
