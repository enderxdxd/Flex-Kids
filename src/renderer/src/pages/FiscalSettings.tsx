import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiscalConfig } from '../../../shared/types';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';

const FiscalSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Omit<FiscalConfig, 'id' | 'createdAt' | 'updatedAt'>>({
    companyName: '',
    cnpj: '',
    ie: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    printerPort: 'COM1',
    printerModel: 'MP-4200',
    enableFiscalPrint: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const savedConfig = await settingsServiceOffline.getFiscalConfig();
      if (savedConfig) {
        setConfig({
          companyName: savedConfig.companyName,
          cnpj: savedConfig.cnpj,
          ie: savedConfig.ie,
          address: savedConfig.address,
          city: savedConfig.city,
          state: savedConfig.state,
          zipCode: savedConfig.zipCode,
          phone: savedConfig.phone,
          printerPort: savedConfig.printerPort,
          printerModel: savedConfig.printerModel,
          enableFiscalPrint: savedConfig.enableFiscalPrint,
        });
      }
    } catch (error) {
      console.error('Error loading fiscal config:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.companyName || !config.cnpj) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      await settingsServiceOffline.saveFiscalConfig(config);
      toast.success('✅ Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving fiscal config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrinter = async () => {
    if (!config.enableFiscalPrint) {
      toast.warning('Habilite a impressão fiscal primeiro');
      return;
    }

    try {
      setTesting(true);
      const fullConfig: FiscalConfig = {
        id: 'fiscalConfig',
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const connected = await bematechService.initialize(fullConfig);
      
      if (connected) {
        const status = await bematechService.checkPrinterStatus();
        if (status.connected) {
          toast.success('✅ Impressora conectada e operacional!');
          
          await bematechService.printNonFiscalReport(
            'TESTE DE CONEXÃO',
            [
              '================================',
              'Impressora fiscal conectada',
              `Modelo: ${config.printerModel}`,
              `Porta: ${config.printerPort}`,
              '================================',
              'Teste realizado com sucesso!',
            ]
          );
        } else {
          toast.error(`❌ Erro: ${status.error}`);
        }
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

  const handleChange = (field: keyof typeof config, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatZipCode = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Configurações Fiscais</h1>
          <p className="text-gray-500">Configure os dados da empresa e impressora fiscal Bematech</p>
        </div>
        <div className="flex gap-3">
          {config.enableFiscalPrint && (
            <button
              onClick={handleTestPrinter}
              disabled={testing || loading}
              className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span>{testing ? '⏳' : '🖨️'}</span>
              {testing ? 'Testando...' : 'Testar Impressora'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>{loading ? '⏳' : '💾'}</span>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableFiscalPrint}
              onChange={(e) => handleChange('enableFiscalPrint', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-gray-800">📄 Habilitar Emissão de Nota Fiscal</span>
              <p className="text-xs text-gray-600">Ativar impressão fiscal no checkout</p>
            </div>
          </label>
        </div>

        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">🏢 Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razão Social *
              </label>
              <input
                type="text"
                value={config.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CNPJ *
              </label>
              <input
                type="text"
                value={config.cnpj}
                onChange={(e) => handleChange('cnpj', e.target.value)}
                onBlur={(e) => handleChange('cnpj', formatCNPJ(e.target.value))}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inscrição Estadual
              </label>
              <input
                type="text"
                value={config.ie}
                onChange={(e) => handleChange('ie', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="000.000.000.000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endereço
              </label>
              <input
                type="text"
                value={config.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Rua, número, complemento"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cidade
              </label>
              <input
                type="text"
                value={config.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Nome da cidade"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={config.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecione</option>
                <option value="AC">AC</option>
                <option value="AL">AL</option>
                <option value="AP">AP</option>
                <option value="AM">AM</option>
                <option value="BA">BA</option>
                <option value="CE">CE</option>
                <option value="DF">DF</option>
                <option value="ES">ES</option>
                <option value="GO">GO</option>
                <option value="MA">MA</option>
                <option value="MT">MT</option>
                <option value="MS">MS</option>
                <option value="MG">MG</option>
                <option value="PA">PA</option>
                <option value="PB">PB</option>
                <option value="PR">PR</option>
                <option value="PE">PE</option>
                <option value="PI">PI</option>
                <option value="RJ">RJ</option>
                <option value="RN">RN</option>
                <option value="RS">RS</option>
                <option value="RO">RO</option>
                <option value="RR">RR</option>
                <option value="SC">SC</option>
                <option value="SP">SP</option>
                <option value="SE">SE</option>
                <option value="TO">TO</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CEP
              </label>
              <input
                type="text"
                value={config.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                onBlur={(e) => handleChange('zipCode', formatZipCode(e.target.value))}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="00000-000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="text"
                value={config.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="(00) 0000-0000"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">🖨️ Configurações da Impressora</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo da Impressora
              </label>
              <select
                value={config.printerModel}
                onChange={(e) => handleChange('printerModel', e.target.value as any)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="MP-4200">Bematech MP-4200 TH FI II</option>
                <option value="MP-2100">Bematech MP-2100 TH FI</option>
                <option value="MP-7000">Bematech MP-7000 TH FI</option>
                <option value="other">Outro modelo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porta Serial
              </label>
              <select
                value={config.printerPort}
                onChange={(e) => handleChange('printerPort', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="AUTO">🔍 Detectar Automaticamente (Recomendado)</option>
                <option value="COM1">COM1</option>
                <option value="COM2">COM2</option>
                <option value="COM3">COM3</option>
                <option value="COM4">COM4</option>
                <option value="COM5">COM5</option>
                <option value="COM6">COM6</option>
                <option value="USB">USB</option>
              </select>
            </div>
          </div>

          <div className="mt-4 bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✅ Sistema Pronto para Produção:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
              <li><strong>Detecção Automática:</strong> O sistema detecta a impressora automaticamente</li>
              <li><strong>Driver:</strong> Instale o driver Bematech no Windows</li>
              <li><strong>Conexão:</strong> Conecte a impressora via USB ou Serial</li>
              <li><strong>Teste:</strong> Use o botão "Testar Impressora" para validar</li>
            </ul>
          </div>
          
          <div className="mt-4 bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>📋 Checklist de Configuração:</strong>
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
              <li>Preencha todos os dados da empresa (CNPJ obrigatório)</li>
              <li>Selecione o modelo correto da impressora</li>
              <li>Deixe em "Detectar Automaticamente" (recomendado)</li>
              <li>Marque "Habilitar Emissão de Nota Fiscal"</li>
              <li>Clique em "Salvar"</li>
              <li>Clique em "Testar Impressora" para validar</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiscalSettings;
