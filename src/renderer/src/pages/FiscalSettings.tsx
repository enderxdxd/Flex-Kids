import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiscalConfig } from '../../../shared/types';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';
import { useUnit } from '../contexts/UnitContext';

const FiscalSettings: React.FC = () => {
  const { currentUnit } = useUnit();
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
      const savedConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);
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
      await settingsServiceOffline.saveFiscalConfig(config, currentUnit);
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
        const errorDetail = bematechService.getLastError();
        toast.error(`❌ ${errorDetail || 'Não foi possível conectar à impressora'}`, { autoClose: 8000 });
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
          <h1 className="text-display bg-brand-gradient bg-clip-text text-transparent">Configurações Fiscais</h1>
          <p className="text-sm text-slate-500 mt-1">Configure os dados da empresa e impressora fiscal Bematech</p>
        </div>
        <div className="flex gap-3">
          {config.enableFiscalPrint && (
            <button
              onClick={handleTestPrinter}
              disabled={testing || loading}
              className="h-10 px-4 rounded-lg text-sm font-semibold bg-white text-brand-700 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span>{testing ? <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.034V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" /></svg>}</span>
              {testing ? 'Testando...' : 'Testar Impressora'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="h-10 px-5 rounded-lg text-sm font-semibold bg-brand-gradient text-white shadow-brand-sm hover:brightness-110 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>{loading ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}</span>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-card-lg shadow-card border border-slate-200/80 p-6 space-y-6">
        <div className="bg-gradient-to-br from-brand-50 to-fuchsia-50/40 border border-brand-200/50 p-4 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableFiscalPrint}
              onChange={(e) => handleChange('enableFiscalPrint', e.target.checked)}
              className="w-5 h-5 text-brand-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-900 flex items-center gap-1.5"><svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg> Habilitar Emissão de Nota Fiscal</span>
              <p className="text-xs text-slate-600">Ativar impressão fiscal no checkout</p>
            </div>
          </label>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg> Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Razão Social *
              </label>
              <input
                type="text"
                value={config.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                CNPJ *
              </label>
              <input
                type="text"
                value={config.cnpj}
                onChange={(e) => handleChange('cnpj', e.target.value)}
                onBlur={(e) => handleChange('cnpj', formatCNPJ(e.target.value))}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Inscrição Estadual
              </label>
              <input
                type="text"
                value={config.ie}
                onChange={(e) => handleChange('ie', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="000.000.000.000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Endereço
              </label>
              <input
                type="text"
                value={config.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="Rua, número, complemento"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Cidade
              </label>
              <input
                type="text"
                value={config.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="Nome da cidade"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Estado
              </label>
              <select
                value={config.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                CEP
              </label>
              <input
                type="text"
                value={config.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                onBlur={(e) => handleChange('zipCode', formatZipCode(e.target.value))}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="00000-000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Telefone
              </label>
              <input
                type="text"
                value={config.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
                placeholder="(00) 0000-0000"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12Zm-2.25 0h.008v.008H16.5V12Z" /></svg> Configurações da Impressora</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo da Impressora
              </label>
              <select
                value={config.printerModel}
                onChange={(e) => handleChange('printerModel', e.target.value as any)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
              >
                <option value="MP-4200">Bematech MP-4200 TH FI II</option>
                <option value="MP-2100">Bematech MP-2100 TH FI</option>
                <option value="MP-7000">Bematech MP-7000 TH FI</option>
                <option value="other">Outro modelo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Porta Serial
              </label>
              <select
                value={config.printerPort}
                onChange={(e) => handleChange('printerPort', e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 hover:border-brand-300 transition-all"
              >
                <option value="AUTO">Detectar Automaticamente (Recomendado)</option>
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
              <strong>Sistema Pronto para Produção:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
              <li><strong>Detecção Automática:</strong> O sistema detecta a impressora automaticamente</li>
              <li><strong>Driver:</strong> Instale o driver Bematech no Windows</li>
              <li><strong>Conexão:</strong> Conecte a impressora via USB ou Serial</li>
              <li><strong>Teste:</strong> Use o botão "Testar Impressora" para validar</li>
            </ul>
          </div>
          
          <div className="mt-4 bg-gradient-to-br from-brand-50 to-fuchsia-50/40 border border-brand-200/50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Checklist de Configuração:</strong>
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
