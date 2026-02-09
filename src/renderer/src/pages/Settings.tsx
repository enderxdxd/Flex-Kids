import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';

const Settings: React.FC = () => {
  const [hourlyRate, setHourlyRate] = useState('30.00');
  const [minimumTime, setMinimumTime] = useState('30');
  const [pixKey, setPixKey] = useState('');
  const [enablePrinting, setEnablePrinting] = useState(false);
  const [printerPort, setPrinterPort] = useState('AUTO');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [hourlyRateValue, minimumTimeValue, pixKeyValue, fiscalConfig] = await Promise.all([
        settingsServiceOffline.getHourlyRate(),
        settingsServiceOffline.getMinimumTime(),
        settingsServiceOffline.getPixKey(),
        settingsServiceOffline.getFiscalConfig(),
      ]);
      setHourlyRate(hourlyRateValue.toString());
      setMinimumTime(minimumTimeValue.toString());
      setPixKey(pixKeyValue || '');
      if (fiscalConfig) {
        setEnablePrinting(fiscalConfig.enableFiscalPrint);
        setPrinterPort(fiscalConfig.printerPort || 'AUTO');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      toast.error('Valor por hora deve ser maior que zero');
      return;
    }

    if (!minimumTime || parseInt(minimumTime) <= 0) {
      toast.error('Tempo mínimo deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        settingsServiceOffline.setHourlyRate(parseFloat(hourlyRate)),
        settingsServiceOffline.setMinimumTime(parseInt(minimumTime)),
        settingsServiceOffline.setPixKey(pixKey),
        settingsServiceOffline.saveFiscalConfig({
          companyName: 'Flex-Kids',
          cnpj: '',
          ie: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          phone: '',
          printerPort: printerPort,
          printerModel: 'MP-4200',
          enableFiscalPrint: enablePrinting,
        }),
      ]);
      toast.success('✅ Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePrintingChange = async (enabled: boolean) => {
    setEnablePrinting(enabled);
    
    // Salvar automaticamente
    try {
      await settingsServiceOffline.saveFiscalConfig({
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: printerPort,
        printerModel: 'MP-4200',
        enableFiscalPrint: enabled,
      });
      toast.success(enabled ? '✅ Impressão habilitada!' : '✅ Impressão desabilitada!');
    } catch (error) {
      console.error('Error saving print config:', error);
      toast.error('Erro ao salvar configuração');
    }
  };

  const handlePrinterPortChange = async (port: string) => {
    setPrinterPort(port);
    
    // Salvar automaticamente
    try {
      await settingsServiceOffline.saveFiscalConfig({
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: port,
        printerModel: 'MP-4200',
        enableFiscalPrint: enablePrinting,
      });
      toast.success('✅ Porta atualizada!');
    } catch (error) {
      console.error('Error saving port config:', error);
      toast.error('Erro ao salvar porta');
    }
  };

  const handleTestPrinter = async () => {
    if (!enablePrinting) {
      toast.warning('Habilite a impressão primeiro');
      return;
    }

    try {
      setTesting(true);
      const config = {
        id: 'fiscalConfig',
        companyName: 'Flex-Kids',
        cnpj: '',
        ie: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        printerPort: printerPort,
        printerModel: 'MP-4200' as const,
        enableFiscalPrint: enablePrinting,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const connected = await bematechService.initialize(config);
      
      if (connected) {
        await bematechService.printNonFiscalReport(
          'TESTE DE IMPRESSORA',
          [
            '================================',
            'Teste de conexão realizado',
            `Porta: ${printerPort}`,
            'Sistema: Flex-Kids',
            '================================',
            'Impressora funcionando!',
          ]
        );
        toast.success('✅ Impressora testada com sucesso!');
      } else {
        toast.error('❌ Não foi possível conectar à impressora');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      toast.error('Erro ao testar impressora');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">Configurações gerais do sistema</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cobrança */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Cobrança</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valor por Hora (R$)</label>
                  <input type="number" step="0.01" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="30.00" />
                  <p className="text-[11px] text-slate-400 mt-1">Valor por hora no playground</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tempo Mínimo (min)</label>
                  <input type="number" min="0" value={minimumTime} onChange={(e) => setMinimumTime(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="30" />
                  <p className="text-[11px] text-slate-400 mt-1">Cobrança mínima</p>
                </div>
              </div>
            </div>

            {/* PIX */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">Chave PIX</h2>
              <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="CPF, email, telefone ou chave aleatória" />
              <p className="text-[11px] text-slate-400 mt-1">Chave PIX para recebimento de pagamentos</p>
            </div>

            {/* Impressora */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Impressora</h2>
                {enablePrinting && (
                  <button onClick={handleTestPrinter} disabled={testing} className="text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50">
                    {testing ? '⏳ Testando...' : '🖨️ Testar Impressora'}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={enablePrinting} onChange={(e) => handleEnablePrintingChange(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
                <span className="text-sm text-slate-700">Habilitar impressão de comprovante</span>
              </label>
              {enablePrinting && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Porta</label>
                  <select value={printerPort} onChange={(e) => handlePrinterPortChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="AUTO">Detectar Automaticamente</option>
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                  </select>
                </div>
              )}
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm">
              {saving ? '⏳ Salvando...' : 'Salvar Configurações'}
            </button>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Resumo</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Valor/Hora</span>
                  <span className="text-sm font-bold text-slate-800">R$ {parseFloat(hourlyRate || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Tempo Mínimo</span>
                  <span className="text-sm font-bold text-slate-800">{minimumTime} min</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">PIX</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pixKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{pixKey ? 'Configurado' : 'Não configurado'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-slate-500">Impressora</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${enablePrinting ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{enablePrinting ? 'Ativa' : 'Desativada'}</span>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Sistema</h2>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex justify-between"><span>Versão</span><span className="font-medium text-slate-700">1.0.0</span></div>
                <div className="flex justify-between"><span>Plataforma</span><span className="font-medium text-slate-700">Electron + React</span></div>
                <div className="flex justify-between"><span>Banco</span><span className="font-medium text-slate-700">Cloud Firestore</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
