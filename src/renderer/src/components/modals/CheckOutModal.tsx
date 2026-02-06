import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Visit, Package, Child, Customer, FiscalConfig } from '../../../../shared/types';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';
import { paymentsServiceOffline } from '../../../../shared/firebase/services/payments.service.offline';
import { customersServiceOffline } from '../../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../../shared/services/bematech.service';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visit: Visit;
}

const CheckOutModal: React.FC<CheckOutModalProps> = ({ isOpen, onClose, onSuccess, visit }) => {
  const [child, setChild] = useState<Child | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState(30);
  const [minimumTime, setMinimumTime] = useState(30);
  const [duration, setDuration] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'pix' | 'package'>('cash');
  const [loading, setLoading] = useState(false);
  const [printFiscalNote, setPrintFiscalNote] = useState(true);
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);

  useEffect(() => {
    if (isOpen && visit) {
      loadData();
      calculateDuration();
    }
  }, [isOpen, visit]);

  useEffect(() => {
    calculateValue();
  }, [duration, selectedPackage, hourlyRate, minimumTime]);

  const loadData = async () => {
    try {
      const [childData, settings] = await Promise.all([
        customersServiceOffline.getChildById(visit.childId),
        settingsServiceOffline.getSettings(),
      ]);

      if (childData) {
        setChild(childData);
        const customerData = await customersServiceOffline.getCustomerById(childData.customerId);
        setCustomer(customerData);

        // Buscar pacotes ativos do cliente
        const allPackages = await packagesServiceOffline.getAllPackages();
        const activePackages = allPackages.filter(
          p => p.customerId === childData.customerId && p.active && p.usedHours < p.hours
        );
        setPackages(activePackages);
      } else {
        // Fallback: tenta buscar via getAllChildren
        console.warn('[CHECKOUT] Criança não encontrada via getChildById, tentando fallback...');
        const allChildren = await customersServiceOffline.getAllChildren();
        const foundChild = allChildren.find(c => c.id === visit.childId);
        if (foundChild) {
          console.log('[CHECKOUT] Criança encontrada via fallback');
          setChild(foundChild);
          const customerData = await customersServiceOffline.getCustomerById(foundChild.customerId);
          setCustomer(customerData);
        } else {
          console.error('[CHECKOUT] Criança não encontrada em nenhum lugar!');
        }
      }

      setHourlyRate(settings.hourlyRate || 30);
      setMinimumTime(settings.minimumTime || 30);

      // Carregar configurações fiscais
      const fiscalSettings = await settingsServiceOffline.getFiscalConfig();
      if (fiscalSettings) {
        setFiscalConfig(fiscalSettings);
        setPrintFiscalNote(fiscalSettings.enableFiscalPrint);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const calculateDuration = () => {
    if (visit.checkIn) {
      const checkInTime = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
      const now = new Date();
      const diffMs = now.getTime() - checkInTime.getTime();
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      setDuration(diffMinutes);
    }
  };

  const calculateValue = () => {
    if (selectedPackage) {
      // Usando pacote - sem custo adicional
      setTotalValue(0);
      setPaymentMethod('package');
    } else {
      // Cobrança por hora
      const hours = duration / 60;
      const value = hours * hourlyRate;
      setTotalValue(Math.round(value * 100) / 100);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedPackage && paymentMethod === 'package') {
      toast.error('Selecione um pacote ou escolha outra forma de pagamento');
      return;
    }

    try {
      setLoading(true);

      // 1. Realizar checkout
      await visitsServiceOffline.checkOut({
        visitId: visit.id,
        duration,
        value: totalValue,
      });

      // 2. Se usar pacote, atualizar horas usadas
      if (selectedPackage) {
        const pkg = packages.find(p => p.id === selectedPackage);
        if (pkg) {
          const hoursUsed = duration / 60;
          await packagesServiceOffline.usePackage(selectedPackage, hoursUsed);
        }
      }

      // 3. Se houver pagamento, registrar
      let paymentId: string | undefined;
      if (totalValue > 0 && paymentMethod !== 'package' && customer) {
        const payment = await paymentsServiceOffline.createPayment({
          customerId: customer.id,
          amount: totalValue,
          method: paymentMethod,
          status: 'paid',
          description: `Pagamento visita - ${child?.name} - ${duration} min`,
        });
        paymentId = payment.id;
      }

      // 4. Emitir nota fiscal se habilitado
      let printSuccess = true;
      console.log('[CHECKOUT] Verificando impressão fiscal:');
      console.log('[CHECKOUT] - printFiscalNote:', printFiscalNote);
      console.log('[CHECKOUT] - enableFiscalPrint:', fiscalConfig?.enableFiscalPrint);
      console.log('[CHECKOUT] - child:', !!child);
      
      // Só precisa de child para imprimir, customer é opcional
      if (printFiscalNote && fiscalConfig?.enableFiscalPrint && child) {
        console.log('[CHECKOUT] Condições atendidas, chamando handleFiscalNote...');
        printSuccess = await handleFiscalNote();
      } else {
        console.log('[CHECKOUT] Impressão fiscal DESABILITADA - condições não atendidas');
      }

      if (printSuccess) {
        toast.success('✅ Check-out realizado com sucesso!');
      } else {
        toast.success('✅ Check-out realizado! (Comprovante não impresso)');
      }
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error('Erro ao realizar check-out');
    } finally {
      setLoading(false);
    }
  };

  const handleFiscalNote = async (): Promise<boolean> => {
    if (!child || !fiscalConfig) return false;

    try {
      // Formatar horários
      const checkInTime = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
      const checkOutTime = new Date();
      const formatTime = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      console.log('[CHECKOUT] Inicializando impressora...');
      
      // Inicializar impressora
      const initialized = await bematechService.initialize(fiscalConfig);
      console.log('[CHECKOUT] Impressora inicializada:', initialized);
      
      if (!initialized) {
        console.warn('[CHECKOUT] Impressora não inicializada - modo simulação');
        return false;
      }
      
      // Imprimir cupom não-fiscal simplificado
      const lines = [
        '================================',
        `CRIANCA: ${child.name}`,
        `RESPONSAVEL: ${customer?.name || 'N/A'}`,
        '',
        `ENTRADA: ${formatTime(checkInTime)}`,
        `SAIDA: ${formatTime(checkOutTime)}`,
        `DURACAO: ${Math.floor(duration / 60)}h ${duration % 60}min`,
        '',
        `VALOR TOTAL: R$ ${totalValue.toFixed(2)}`,
        `PAGAMENTO: ${selectedPackage ? 'PACOTE' : paymentMethod.toUpperCase()}`,
        '================================',
        'Obrigado pela preferencia!',
      ];
      
      console.log('[CHECKOUT] Enviando para impressão...');
      
      const printed = await bematechService.printNonFiscalReport(
        'COMPROVANTE DE ATENDIMENTO',
        lines
      );

      console.log('[CHECKOUT] Resultado da impressão:', printed);

      if (printed) {
        toast.success('📄 Comprovante impresso com sucesso!');
        return true;
      } else {
        toast.warning('⚠️ Impressora não conectada - Comprovante não foi impresso');
        return false;
      }
    } catch (error) {
      console.error('[CHECKOUT] Error printing receipt:', error);
      toast.error('❌ Erro ao processar comprovante');
      return false;
    }
  };

  const handleClose = () => {
    setSelectedPackage('');
    setPaymentMethod('cash');
    onClose();
  };

  if (!isOpen) return null;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">✓</span>
              <div>
                <h3 className="text-2xl font-bold">Check-Out</h3>
                <p className="text-red-100 text-sm">Finalizar visita e processar pagamento</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
            >
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações da Visita */}
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-bold text-gray-800 mb-3">📋 Informações da Visita</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Criança:</span>
                <span className="font-semibold">{child?.name || 'Carregando...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-semibold">{customer?.name || 'Carregando...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duração:</span>
                <span className="font-semibold text-blue-600">{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Pacotes Disponíveis */}
          {packages.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                📦 Pacotes Disponíveis
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedPackage('')}
                  className={`w-full text-left p-4 rounded-lg transition-all ${
                    !selectedPackage
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <p className="font-bold">💰 Pagamento Avulso</p>
                  <p className="text-sm text-gray-600">Pagar por esta visita</p>
                </button>
                {packages.map(pkg => {
                  const remainingHours = pkg.hours - pkg.usedHours;
                  const canUse = remainingHours >= duration / 60;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => canUse && setSelectedPackage(pkg.id)}
                      disabled={!canUse}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedPackage === pkg.id
                          ? 'bg-green-100 border-2 border-green-500'
                          : canUse
                          ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          : 'bg-gray-200 opacity-50 cursor-not-allowed border-2 border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">📦 Pacote {pkg.type === 'hours' ? 'de Horas' : 'Mensal'}</p>
                          <p className="text-sm text-gray-600">
                            {remainingHours.toFixed(1)}h disponíveis de {pkg.hours}h
                          </p>
                        </div>
                        {!canUse && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            Horas insuficientes
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Valor a Pagar */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-green-100 text-sm">Valor Total</p>
                <p className="text-4xl font-bold">
                  {selectedPackage ? 'PACOTE' : `R$ ${totalValue.toFixed(2)}`}
                </p>
              </div>
              <span className="text-6xl">💰</span>
            </div>
          </div>

          {/* Nota Fiscal */}
          {fiscalConfig?.enableFiscalPrint && (
            <div className="bg-blue-50 p-4 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printFiscalNote}
                  onChange={(e) => setPrintFiscalNote(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-gray-800">📄 Emitir Nota Fiscal</span>
                  <p className="text-xs text-gray-600">Impressora: {fiscalConfig.printerModel}</p>
                </div>
              </label>
            </div>
          )}

          {/* Forma de Pagamento */}
          {!selectedPackage && totalValue > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                💳 Forma de Pagamento
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-lg transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="text-3xl mb-2">💵</div>
                  <div className="font-semibold text-sm">Dinheiro</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-lg transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="text-3xl mb-2">💳</div>
                  <div className="font-semibold text-sm">Cartão</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-4 rounded-lg transition-all ${
                    paymentMethod === 'pix'
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="text-3xl mb-2">📱</div>
                  <div className="font-semibold text-sm">PIX</div>
                </button>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={loading || !child}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
            >
              {loading ? '⏳ Processando...' : !child ? '⏳ Carregando...' : '✓ Confirmar Check-Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckOutModal;
