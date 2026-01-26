import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { settingsService } from '@shared/firebase/services';

const Settings: React.FC = () => {
  const [hourlyRate, setHourlyRate] = useState('30.00');
  const [minimumTime, setMinimumTime] = useState('30');
  const [pixKey, setPixKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const hourlyRate = await settingsService.getHourlyRate();
      const minimumTime = await settingsService.getMinimumTime();
      const pixKey = await settingsService.getPixKey();
      setHourlyRate(hourlyRate.toString());
      setMinimumTime(minimumTime.toString());
      setPixKey(pixKey || '');
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await settingsService.setHourlyRate(parseFloat(hourlyRate));
      await settingsService.setMinimumTime(parseInt(minimumTime));
      await settingsService.setPixKey(pixKey);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500 mt-2">Configurações gerais do sistema</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6">Configurações de Cobrança</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor por Hora (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="30.00"
            />
            <p className="text-sm text-gray-500 mt-1">
              Valor cobrado por hora de permanência
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tempo Mínimo (minutos)
            </label>
            <input
              type="number"
              value={minimumTime}
              onChange={(e) => setMinimumTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="30"
            />
            <p className="text-sm text-gray-500 mt-1">
              Tempo mínimo de cobrança em minutos
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chave PIX
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Digite sua chave PIX"
            />
            <p className="text-sm text-gray-500 mt-1">
              Chave PIX para recebimento de pagamentos
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-lg font-medium hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mt-6">
        <h2 className="text-xl font-bold mb-4">Informações do Sistema</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Versão:</strong> 1.0.0</p>
          <p><strong>Desenvolvido para:</strong> Flex-Kids Playground</p>
          <p><strong>Tecnologias:</strong> Electron + React + Firebase</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
