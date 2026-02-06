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
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Configurações</h1>
        <p className="text-gray-500">Configurações gerais do sistema</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">💰</span>
              <h2 className="text-2xl font-bold text-gray-800">Configurações de Cobrança</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  💵 Valor por Hora (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 text-lg font-bold"
                  placeholder="30.00"
                />
                <p className="text-sm text-gray-600 mt-2">
                  💡 Valor cobrado por hora de permanência no playground
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  ⏱️ Tempo Mínimo (minutos)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minimumTime}
                  onChange={(e) => setMinimumTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-bold"
                  placeholder="30"
                />
                <p className="text-sm text-gray-600 mt-2">
                  💡 Tempo mínimo de cobrança (ex: 30 minutos = meia hora mínima)
                </p>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  📱 Chave PIX
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 text-lg"
                  placeholder="Digite sua chave PIX (CPF, email, telefone ou chave aleatória)"
                />
                <p className="text-sm text-gray-600 mt-2">
                  💡 Chave PIX para recebimento de pagamentos dos clientes
                </p>
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-bold text-gray-700">
                    🖨️ Impressão de Comprovante
                  </label>
                  {enablePrinting && (
                    <button
                      onClick={handleTestPrinter}
                      disabled={testing}
                      className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                      {testing ? '⏳ Testando...' : '🖨️ Testar'}
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={enablePrinting}
                    onChange={(e) => handleEnablePrintingChange(e.target.checked)}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-gray-700 font-medium">Habilitar impressão de comprovante no checkout</span>
                </label>
                {enablePrinting && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Porta da Impressora
                    </label>
                    <select
                      value={printerPort}
                      onChange={(e) => handlePrinterPortChange(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                    >
                      <option value="AUTO">🔍 Detectar Automaticamente</option>
                      <option value="COM1">COM1</option>
                      <option value="COM2">COM2</option>
                      <option value="COM3">COM3</option>
                      <option value="COM4">COM4</option>
                    </select>
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-3">
                  💡 Imprime comprovante com entrada, saída, nome da criança e valor total
                </p>
              </div>

              <div className="pt-6 border-t-2 border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg font-bold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                >
                  {saving ? '⏳ Salvando...' : '✓ Salvar Configurações'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>ℹ️</span> Informações do Sistema
              </h3>
              <div className="space-y-2 text-sm">
                <p><strong>Versão:</strong> 1.0.0</p>
                <p><strong>Desenvolvido para:</strong> Flex-Kids Playground</p>
                <p><strong>Tecnologias:</strong> Electron + React + Firebase</p>
                <p><strong>Banco de Dados:</strong> Cloud Firestore</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>📊</span> Resumo de Configurações
              </h3>
              <div className="space-y-3">
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <p className="text-xs opacity-90">Valor/Hora</p>
                  <p className="text-2xl font-bold">R$ {parseFloat(hourlyRate || '0').toFixed(2)}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <p className="text-xs opacity-90">Tempo Mínimo</p>
                  <p className="text-2xl font-bold">{minimumTime} min</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  <p className="text-xs opacity-90">PIX Configurado</p>
                  <p className="text-lg font-bold">{pixKey ? '✓ Sim' : '✗ Não'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg max-w-3xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-bold text-yellow-800 mb-2">Dicas de Uso</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Configure o valor por hora de acordo com seu mercado local</li>
                  <li>• O tempo mínimo ajuda a garantir uma cobrança justa</li>
                  <li>• Mantenha sua chave PIX atualizada para facilitar pagamentos</li>
                  <li>• Revise suas configurações periodicamente</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
