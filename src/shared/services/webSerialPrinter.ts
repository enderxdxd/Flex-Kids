/**
 * Adaptador de impressão via Web Serial API (navegador).
 *
 * No app desktop (Electron) a impressão usa `serialport` no processo main via
 * `window.electronAPI.printer`. No navegador isso não existe, então usamos a
 * Web Serial API (`navigator.serial`), disponível em Chrome/Edge sob HTTPS.
 *
 * Este módulo expõe a MESMA interface de `window.electronAPI.printer`, para que
 * `bematech.service.ts` funcione igual nos dois ambientes. Replica o mesmo
 * protocolo ESC/POS do processo main (encoding latin1, ESC @, corte GS V B 0).
 *
 * Limitações do navegador:
 *  - Requer contexto seguro (HTTPS ou localhost).
 *  - A primeira autorização da porta exige um gesto do usuário
 *    (`requestPort()` — ver botão "Conectar impressora" em Configurações).
 *  - Após autorizada, a permissão persiste por origem e reconectamos via
 *    `getPorts()` sem novo popup.
 */

const BAUD_DEFAULT = 115200;

let _port: any = null;
let _baudRate: number = BAUD_DEFAULT;
let _lastError = '';

function getSerial(): any | null {
  if (typeof navigator !== 'undefined' && (navigator as any).serial) {
    return (navigator as any).serial;
  }
  return null;
}

export function isWebSerialSupported(): boolean {
  return getSerial() !== null;
}

function isPortOpen(): boolean {
  // Em Web Serial, `writable` é não-nulo enquanto a porta está aberta.
  return !!_port && !!_port.writable;
}

/** Converte string em bytes latin1 (ISO-8859-1), igual ao Buffer.from(str,'latin1') do main. */
function latin1Bytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

async function openPort(port: any, baudRate: number): Promise<boolean> {
  try {
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    _port = port;
    _baudRate = baudRate;
    _lastError = '';
    return true;
  } catch (error: any) {
    const msg = error?.message || String(error);
    // Se já está aberta, considera sucesso (reuso).
    if (msg.toLowerCase().includes('already open')) {
      _port = port;
      _baudRate = baudRate;
      _lastError = '';
      return true;
    }
    if (msg.toLowerCase().includes('failed to open') || msg.toLowerCase().includes('access')) {
      _lastError = 'Não foi possível abrir a porta. Ela pode estar em uso por outro programa.';
    } else {
      _lastError = `Erro ao abrir a porta: ${msg}`;
    }
    return false;
  }
}

async function closeCurrentPort(): Promise<void> {
  if (_port) {
    try {
      await _port.close();
    } catch { /* noop */ }
  }
  _port = null;
}

async function writeBytes(bytes: Uint8Array): Promise<boolean> {
  if (!isPortOpen()) {
    _lastError = 'Porta não está aberta';
    return false;
  }
  if (_port.writable.locked) {
    _lastError = 'Fluxo de escrita ocupado';
    return false;
  }
  const writer = _port.writable.getWriter();
  try {
    await writer.write(bytes);
    return true;
  } catch (error: any) {
    _lastError = `Erro ao escrever: ${error?.message || error}`;
    return false;
  } finally {
    try { writer.releaseLock(); } catch { /* noop */ }
  }
}

/**
 * Solicita ao usuário que escolha a porta serial (mostra o popup do navegador).
 * DEVE ser chamado dentro de um gesto do usuário (click). Após autorizada, a
 * permissão persiste e as próximas conexões usam getPorts() sem popup.
 */
async function requestPort(baudRate: number = BAUD_DEFAULT): Promise<boolean> {
  const serial = getSerial();
  if (!serial) {
    _lastError = 'Web Serial não suportado neste navegador (use Chrome ou Edge via HTTPS).';
    return false;
  }
  try {
    const port = await serial.requestPort();
    // Fecha eventual porta anterior antes de abrir a nova.
    await closeCurrentPort();
    return await openPort(port, baudRate);
  } catch (error: any) {
    // O usuário cancelou o popup ou negou a permissão.
    _lastError = error?.name === 'NotFoundError'
      ? 'Nenhuma porta selecionada.'
      : `Erro ao selecionar porta: ${error?.message || error}`;
    return false;
  }
}

export const webSerialPrinter = {
  isSupported: isWebSerialSupported,
  requestPort,

  async listPorts(): Promise<any[]> {
    const serial = getSerial();
    if (!serial) return [];
    try {
      const ports = await serial.getPorts();
      return ports.map((p: any, idx: number) => {
        const info = typeof p.getInfo === 'function' ? p.getInfo() : {};
        return {
          path: `WEBSERIAL:${idx}`,
          manufacturer: 'WebSerial',
          vendorId: info.usbVendorId ? info.usbVendorId.toString(16) : '',
          productId: info.usbProductId ? info.usbProductId.toString(16) : '',
        };
      });
    } catch {
      return [];
    }
  },

  async connect(_portPath?: string, baudRate: number = BAUD_DEFAULT): Promise<boolean> {
    const serial = getSerial();
    if (!serial) {
      _lastError = 'Web Serial não suportado neste navegador.';
      return false;
    }

    // Já conectado → reutiliza.
    if (isPortOpen()) return true;

    // Recupera a porta já autorizada (persiste por origem). Não abre popup.
    let port = _port;
    if (!port) {
      try {
        const granted = await serial.getPorts();
        port = granted[0] || null;
      } catch {
        port = null;
      }
    }

    if (!port) {
      _lastError = 'Nenhuma impressora autorizada. Clique em "Conectar impressora" nas Configurações.';
      return false;
    }

    return await openPort(port, baudRate);
  },

  async disconnect(): Promise<boolean> {
    await closeCurrentPort();
    return true;
  },

  async sendCommand(command: string): Promise<boolean> {
    return await writeBytes(latin1Bytes(command));
  },

  async sendRaw(data: number[]): Promise<boolean> {
    return await writeBytes(Uint8Array.from(data));
  },

  async getStatus(): Promise<{ connected: boolean; portOpen: boolean; serialportAvailable: boolean; lastError?: string }> {
    return {
      connected: isPortOpen(),
      portOpen: isPortOpen(),
      serialportAvailable: isWebSerialSupported(),
      lastError: _lastError || undefined,
    };
  },

  /** Imprime texto usando ESC/POS — mesma sequência do processo main. */
  async printText(text: string): Promise<boolean> {
    if (!isPortOpen()) {
      _lastError = 'Porta não está aberta';
      return false;
    }
    // ESC @ (inicializa)
    if (!(await this.sendCommand('\x1B\x40'))) return false;
    await new Promise(r => setTimeout(r, 100));
    // Texto
    if (!(await this.sendCommand(text))) return false;
    await new Promise(r => setTimeout(r, 100));
    // Avança papel
    await this.sendCommand('\n\n\n\n\n');
    await new Promise(r => setTimeout(r, 100));
    // GS V B 0 — corte parcial com avanço
    await this.sendCommand('\x1D\x56\x42\x00');
    return true;
  },

  async printTest(_portPath?: string): Promise<{ success: boolean; error?: string }> {
    const connected = await this.connect(_portPath, _baudRate);
    if (!connected) {
      return { success: false, error: _lastError || 'Não foi possível conectar à impressora' };
    }
    const lines = [
      '================================',
      '     TESTE DE IMPRESSAO',
      '================================',
      '',
      'Impressora conectada (navegador)!',
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      '',
      '================================',
      '        FLEX-KIDS',
      '================================',
      '', '', '',
    ];
    const printed = await this.printText(lines.join('\n'));
    if (!printed) return { success: false, error: _lastError || 'Erro ao enviar dados para impressora' };
    return { success: true };
  },

  getLastError(): string {
    return _lastError;
  },
};

export type WebSerialPrinter = typeof webSerialPrinter;
