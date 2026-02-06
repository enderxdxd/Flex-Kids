import { FiscalNote, FiscalConfig, FiscalItem } from '../types';

/**
 * Serviço de integração com impressoras fiscais Bematech
 * Suporta modelos: MP-4200, MP-2100, MP-7000
 * 
 * Usa IPC para comunicar com o main process do Electron onde o serialport funciona
 */

// Acessa a API do Electron exposta via preload
declare global {
  interface Window {
    electronAPI?: {
      printer: {
        listPorts: () => Promise<any[]>;
        connect: (portPath: string, baudRate?: number) => Promise<boolean>;
        disconnect: () => Promise<boolean>;
        sendCommand: (command: string) => Promise<boolean>;
        sendRaw: (data: number[]) => Promise<boolean>;
        getStatus: () => Promise<{ connected: boolean; portOpen: boolean; serialportAvailable: boolean }>;
        printText: (text: string) => Promise<boolean>;
        printTest: (portPath: string) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

function getPrinterAPI() {
  console.log('[BEMATECH] getPrinterAPI chamado');
  console.log('[BEMATECH] window.electronAPI:', typeof window !== 'undefined' ? window.electronAPI : 'undefined');
  
  if (typeof window !== 'undefined' && window.electronAPI?.printer) {
    console.log('[BEMATECH] ✅ API de impressora encontrada');
    return window.electronAPI.printer;
  }
  console.warn('[BEMATECH] ❌ API de impressora NÃO encontrada');
  return null;
}

export class BematechService {
  private config: FiscalConfig | null = null;
  private port: any = null;
  private isConnected: boolean = false;
  private isSimulationMode: boolean = false;

  /**
   * Detecta automaticamente a porta da impressora Bematech
   */
  async detectPrinterPort(): Promise<string | null> {
    const api = getPrinterAPI();
    if (!api) {
      console.log('API de impressora não disponível - usando porta configurada');
      return null;
    }

    try {
      const ports = await api.listPorts();
      
      // Procura por portas COM ou dispositivos Bematech
      for (const port of ports) {
        const portName = port.path.toUpperCase();
        const manufacturer = (port.manufacturer || '').toUpperCase();
        const vendorId = port.vendorId || '';
        
        // Verifica se é uma porta COM ou dispositivo Bematech
        if (
          portName.includes('COM') || 
          manufacturer.includes('BEMATECH') ||
          vendorId === '0B1B' // Vendor ID da Bematech
        ) {
          console.log(`Impressora detectada em: ${port.path}`);
          return port.path;
        }
      }
      
      // Se não encontrou, retorna primeira porta COM disponível
      const comPort = ports.find((p: any) => p.path.toUpperCase().includes('COM'));
      if (comPort) {
        console.log(`Usando porta padrão: ${comPort.path}`);
        return comPort.path;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao detectar porta:', error);
      return null;
    }
  }

  /**
   * Inicializa a conexão com a impressora fiscal
   */
  async initialize(config: FiscalConfig): Promise<boolean> {
    console.log('[BEMATECH] ========== INITIALIZE ==========');
    console.log('[BEMATECH] Config recebida:', JSON.stringify(config, null, 2));
    this.config = config;

    if (!config.enableFiscalPrint) {
      console.log('[BEMATECH] Impressão fiscal desabilitada nas configurações');
      return false;
    }

    const api = getPrinterAPI();
    if (!api) {
      console.warn('[BEMATECH] ⚠️ API de impressora não disponível - modo simulação');
      this.isConnected = false;
      this.isSimulationMode = true;
      return false;
    }

    try {
      // Verifica se serialport está disponível no main process
      const status = await api.getStatus();
      if (!status.serialportAvailable) {
        console.warn('⚠️ SerialPort não disponível no main process - modo simulação');
        this.isConnected = false;
        this.isSimulationMode = true;
        return false;
      }

      // Detecta porta automaticamente se configurada como AUTO
      let portPath = config.printerPort;
      if (portPath === 'AUTO' || !portPath) {
        const detected = await this.detectPrinterPort();
        if (detected) {
          portPath = detected;
          console.log(`Porta detectada automaticamente: ${portPath}`);
        } else {
          portPath = 'COM1'; // Fallback
        }
      }

      // Conecta via IPC
      const connected = await api.connect(portPath, 9600);
      
      if (connected) {
        console.log(`✅ Conectado à impressora fiscal na porta ${portPath}`);
        this.isConnected = true;
        this.isSimulationMode = false;
        this.port = portPath; // Guarda a porta para referência
        return true;
      } else {
        console.error(`❌ Falha ao conectar na porta ${portPath}`);
        this.isConnected = false;
        this.isSimulationMode = true;
        return false;
      }
    } catch (error) {
      console.error('Erro ao conectar com impressora fiscal:', error);
      this.isConnected = false;
      this.isSimulationMode = true;
      return false;
    }
  }

  /**
   * Verifica se a impressora está conectada e operacional
   */
  async checkPrinterStatus(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isConnected || !this.config?.enableFiscalPrint) {
      return { connected: false, error: 'Impressora não conectada' };
    }

    try {
      // Comando Bematech para verificar status: ESC + 19
      await this.sendCommand('\x1B\x13');
      return { connected: true };
    } catch (error) {
      return { connected: false, error: 'Erro ao comunicar com impressora' };
    }
  }

  /**
   * Abre um cupom fiscal
   */
  private async openFiscalCoupon(customerCpf?: string): Promise<void> {
    if (!this.isConnected) throw new Error('Impressora não conectada');

    // Comando Bematech para abrir cupom fiscal
    // ESC + 0 + CPF/CNPJ + Nome + Endereço
    const cpf = customerCpf || '';
    const command = `\x1B\x00${cpf}\x00\x00\x00`;
    
    await this.sendCommand(command);
    console.log('Cupom fiscal aberto');
  }

  /**
   * Registra um item no cupom fiscal
   */
  private async registerItem(item: FiscalItem, itemNumber: number): Promise<void> {
    if (!this.isConnected) throw new Error('Impressora não conectada');

    // Comando Bematech para registrar item
    // ESC + 9 + Código + Descrição + Alíquota + Tipo + Quantidade + Casas decimais + Valor unitário + Casas decimais
    const code = itemNumber.toString().padStart(13, '0');
    const description = item.description.substring(0, 29).padEnd(29, ' ');
    const quantity = (item.quantity * 1000).toString().padStart(7, '0'); // 3 casas decimais
    const unitPrice = (item.unitPrice * 100).toString().padStart(8, '0'); // 2 casas decimais
    const taxCode = item.taxCode || 'T1'; // Tributado ICMS
    
    const command = `\x1B\x09${code}${description}${taxCode}F${quantity}3${unitPrice}2`;
    
    await this.sendCommand(command);
    console.log(`Item registrado: ${item.description} - R$ ${item.total.toFixed(2)}`);
  }

  /**
   * Aplica desconto no cupom
   */
  private async applyDiscount(discountValue: number): Promise<void> {
    if (!this.isConnected || discountValue <= 0) return;

    // Comando Bematech para desconto
    // ESC + 4 + Tipo ($ ou %) + Valor
    const value = (discountValue * 100).toString().padStart(10, '0');
    const command = `\x1B\x04$${value}`;
    
    await this.sendCommand(command);
    console.log(`Desconto aplicado: R$ ${discountValue.toFixed(2)}`);
  }

  /**
   * Finaliza o cupom com forma de pagamento
   */
  private async finalizeCoupon(
    paymentMethod: string,
    totalValue: number,
    message?: string
  ): Promise<void> {
    if (!this.isConnected) throw new Error('Impressora não conectada');

    // Mapear forma de pagamento para código Bematech
    const paymentCodes: Record<string, string> = {
      'dinheiro': '01',
      'cash': '01',
      'cartao': '02',
      'card': '02',
      'pix': '03',
      'pacote': '99',
      'package': '99',
    };

    const paymentCode = paymentCodes[paymentMethod.toLowerCase()] || '01';
    const value = (totalValue * 100).toString().padStart(14, '0');
    
    // Comando Bematech para totalizar/finalizar
    // ESC + 22 + Forma de pagamento + Valor + Mensagem promocional
    const promoMessage = message || '';
    const command = `\x1B\x16${paymentCode}${value}${promoMessage}`;
    
    await this.sendCommand(command);
    console.log(`Cupom finalizado - ${paymentMethod}: R$ ${totalValue.toFixed(2)}`);
  }

  /**
   * Fecha o cupom fiscal
   */
  private async closeFiscalCoupon(): Promise<void> {
    if (!this.isConnected) throw new Error('Impressora não conectada');

    // Comando Bematech para fechar cupom
    // ESC + 23
    const command = '\x1B\x17';
    
    await this.sendCommand(command);
    console.log('Cupom fiscal fechado');
  }

  /**
   * Cancela o último cupom fiscal emitido
   */
  async cancelLastCoupon(): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Impressora não conectada');
    }

    try {
      // Comando Bematech para cancelar cupom
      // ESC + 24
      const command = '\x1B\x18';
      
      await this.sendCommand(command);
      console.log('Cupom fiscal cancelado');
      return true;
    } catch (error) {
      console.error('Erro ao cancelar cupom:', error);
      return false;
    }
  }

  /**
   * Emite uma nota fiscal completa
   */
  async printFiscalNote(fiscalNote: FiscalNote): Promise<{
    success: boolean;
    fiscalNumber?: string;
    error?: string;
  }> {
    if (!this.config?.enableFiscalPrint) {
      return {
        success: false,
        error: 'Impressão fiscal desabilitada',
      };
    }

    if (!this.isConnected) {
      const connected = await this.initialize(this.config);
      if (!connected) {
        return {
          success: false,
          error: 'Não foi possível conectar à impressora fiscal',
        };
      }
    }

    try {
      console.log('=== INICIANDO EMISSÃO DE NOTA FISCAL ===');
      console.log(`Cliente: ${fiscalNote.customerName}`);
      console.log(`CPF: ${fiscalNote.customerCpf || 'Não informado'}`);
      console.log(`Total: R$ ${fiscalNote.total.toFixed(2)}`);

      // 1. Abrir cupom fiscal
      await this.openFiscalCoupon(fiscalNote.customerCpf);

      // 2. Registrar todos os itens
      for (let i = 0; i < fiscalNote.items.length; i++) {
        await this.registerItem(fiscalNote.items[i], i + 1);
      }

      // 3. Aplicar desconto se houver
      if (fiscalNote.discount > 0) {
        await this.applyDiscount(fiscalNote.discount);
      }

      // 4. Finalizar com forma de pagamento
      const message = `Obrigado pela preferencia!\n${this.config.companyName}`;
      await this.finalizeCoupon(fiscalNote.paymentMethod, fiscalNote.total, message);

      // 5. Fechar cupom
      await this.closeFiscalCoupon();

      // Obter número do cupom fiscal
      const fiscalNumber = await this.getFiscalNumber();

      console.log('=== NOTA FISCAL EMITIDA COM SUCESSO ===');
      console.log(`Número: ${fiscalNumber}`);

      return {
        success: true,
        fiscalNumber,
      };
    } catch (error) {
      console.error('Erro ao emitir nota fiscal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Obtém o número do último cupom fiscal emitido
   */
  private async getFiscalNumber(): Promise<string> {
    try {
      if (this.isConnected && this.port) {
        // Comando para ler número do cupom: ESC + 35
        await this.sendCommand('\x1B\x23');
        // Por enquanto, gera número simulado pois leitura de resposta via IPC é complexa
      }
      
      // Fallback: gera número simulado
      return this.generateFiscalNumber();
    } catch (error) {
      console.error('Erro ao obter número fiscal:', error);
      return this.generateFiscalNumber();
    }
  }

  /**
   * Imprime relatório/comprovante usando ESC/POS (compatível com MP-4200 TH)
   */
  async printNonFiscalReport(title: string, lines: string[]): Promise<boolean> {
    console.log('[BEMATECH] ========== PRINT NON FISCAL (ESC/POS) ==========');
    console.log('[BEMATECH] isSimulationMode:', this.isSimulationMode);
    console.log('[BEMATECH] isConnected:', this.isConnected);
    console.log('[BEMATECH] Título:', title);
    
    // Verifica se está em modo simulação
    if (this.isSimulationMode) {
      console.warn('[BEMATECH] ⚠️ MODO SIMULAÇÃO - Impressora não conectada');
      console.log('=== COMPROVANTE (NÃO IMPRESSO) ===');
      console.log(title);
      lines.forEach(line => console.log(line));
      return false;
    }

    if (!this.isConnected) {
      console.error('[BEMATECH] Impressora não conectada');
      return false;
    }

    try {
      console.log('[BEMATECH] === IMPRIMINDO VIA ESC/POS ===');
      
      const api = getPrinterAPI();
      if (!api) {
        console.error('[BEMATECH] API não disponível');
        return false;
      }
      
      // Monta o texto completo do comprovante
      const fullText = [
        title,
        ...lines,
        '', '', '' // Linhas extras para corte
      ].join('\n');
      
      console.log('[BEMATECH] Enviando para impressora:', fullText.length, 'caracteres');
      
      // Usa printText que já implementa ESC/POS corretamente no main process
      const success = await api.printText(fullText);
      
      if (success) {
        console.log('[BEMATECH] ✅ Impressão enviada com sucesso');
      } else {
        console.error('[BEMATECH] ❌ Falha ao enviar para impressora');
      }
      
      return success;
    } catch (error) {
      console.error('[BEMATECH] Erro ao imprimir relatório:', error);
      return false;
    }
  }

  /**
   * Leitura X - Relatório de vendas sem redução Z
   */
  async printReadingX(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      // Comando Bematech para Leitura X
      // ESC + 6
      const command = '\x1B\x06';
      
      await this.sendCommand(command);
      console.log('Leitura X impressa');
      return true;
    } catch (error) {
      console.error('Erro ao imprimir Leitura X:', error);
      return false;
    }
  }

  /**
   * Redução Z - Fechamento do dia fiscal
   */
  async printReductionZ(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      // Comando Bematech para Redução Z
      // ESC + 5
      const command = '\x1B\x05';
      
      await this.sendCommand(command);
      console.log('Redução Z impressa - Dia fiscal encerrado');
      return true;
    } catch (error) {
      console.error('Erro ao imprimir Redução Z:', error);
      return false;
    }
  }

  /**
   * Envia comando para a impressora via IPC
   */
  private async sendCommand(command: string): Promise<void> {
    const api = getPrinterAPI();
    if (api && this.isConnected) {
      // Modo produção - envia para impressora real via IPC
      const success = await api.sendCommand(command);
      if (!success) {
        throw new Error('Falha ao enviar comando para impressora');
      }
    } else {
      // Modo simulação para desenvolvimento
      console.log(`[SIMULAÇÃO] Comando enviado: ${command.length} bytes`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Gera número de cupom fiscal (simulado)
   */
  private generateFiscalNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    
    return `${year}${month}${day}${random}`;
  }

  /**
   * Desconecta da impressora via IPC
   */
  async disconnect(): Promise<void> {
    const api = getPrinterAPI();
    if (api) {
      await api.disconnect();
    }
    this.port = null;
    this.isConnected = false;
    this.isSimulationMode = false;
    console.log('Desconectado da impressora fiscal');
  }
}

// Instância singleton
export const bematechService = new BematechService();
