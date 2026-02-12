import React, { useState, useEffect, useRef } from 'react';
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

const ADMIN_PASSWORD = 'pactoflex123';

const CheckOutModal: React.FC<CheckOutModalProps> = ({ isOpen, onClose, onSuccess, visit }) => {
  const [child, setChild] = useState<Child | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState(30);
  const [minimumTime, setMinimumTime] = useState(30);
  const [duration, setDuration] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'package'>('pix');
  const [loading, setLoading] = useState(false);
  const [printFiscalNote, setPrintFiscalNote] = useState(true);
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const processingRef = useRef(false);

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
      const [childData, settings, allCustomers] = await Promise.all([
        customersServiceOffline.getChildById(visit.childId),
        settingsServiceOffline.getSettings(),
        customersServiceOffline.getAllCustomers(),
      ]);
      
      setCustomers(allCustomers);

      if (childData) {
        setChild(childData);
        const customerData = await customersServiceOffline.getCustomerById(childData.customerId);
        setCustomer(customerData);

        // Buscar pacotes ativos do cliente
        const allPackagesData = await packagesServiceOffline.getAllPackages();
        const activePackages = allPackagesData.filter(
          p => p.customerId === childData.customerId && p.active && p.usedHours < p.hours
        );
        setPackages(activePackages);
        
        // Guardar todos os pacotes para opção de admin
        const otherActivePackages = allPackagesData.filter(
          p => p.customerId !== childData.customerId && p.active && p.usedHours < p.hours
        );
        setAllPackages(otherActivePackages);
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
    if (processingRef.current) return;
    processingRef.current = true;

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
      if (totalValue > 0 && paymentMethod !== 'package' && customer && child) {
        console.log('[CHECKOUT] Criando pagamento:', {
          customerId: customer.id,
          childId: child.id,
          childName: child.name,
          amount: totalValue,
        });
        
        const payment = await paymentsServiceOffline.createPayment({
          customerId: customer.id,
          childId: child.id,
          childName: child.name,
          amount: totalValue,
          method: paymentMethod,
          status: 'paid',
          type: 'visit',
          unitId: visit.unitId,
          description: `Pagamento visita - ${child.name} - ${duration} min`,
        });
        console.log('[CHECKOUT] Pagamento criado:', payment.id);
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
      processingRef.current = false;
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
    setPaymentMethod('pix');
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    onClose();
  };

  if (!isOpen) return null;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Check-Out</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Visit Info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Criança</span>
                <span className="font-semibold text-slate-800">{child?.name || 'Carregando...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável</span>
                <span className="font-semibold text-slate-800">{customer?.name || 'Carregando...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duração</span>
                <span className="font-bold text-violet-600">{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Packages */}
          {packages.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Usar Pacote</label>
              <div className="space-y-1">
                <button type="button" onClick={() => setSelectedPackage('')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${!selectedPackage ? 'bg-violet-50 border border-violet-300' : 'hover:bg-slate-50 border border-transparent'}`}>
                  <p className="font-semibold text-slate-800">Pagamento Avulso</p>
                </button>
                {packages.map(pkg => {
                  const remainingHours = pkg.hours - pkg.usedHours;
                  const canUse = remainingHours >= duration / 60;
                  return (
                    <button key={pkg.id} type="button" onClick={() => canUse && setSelectedPackage(pkg.id)} disabled={!canUse}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${selectedPackage === pkg.id ? 'bg-emerald-50 border border-emerald-300' : canUse ? 'hover:bg-slate-50 border border-transparent' : 'opacity-40 cursor-not-allowed border border-transparent'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-800">{pkg.type}</p>
                          <p className="text-xs text-slate-500">{remainingHours.toFixed(1)}h de {pkg.hours}h</p>
                        </div>
                        {!canUse && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Insuficiente</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin Packages */}
          {allPackages.length > 0 && (
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 mb-2">Pacote de Outro Cliente (Admin)</p>
              {!isAdminAuthenticated ? (
                <div className="flex gap-2">
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Senha admin" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <button onClick={() => { if (adminPassword === ADMIN_PASSWORD) { setIsAdminAuthenticated(true); toast.success('Autenticado'); } else { toast.error('Senha incorreta'); setAdminPassword(''); } }} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600">Entrar</button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-emerald-700 font-medium">Admin autenticado</span>
                    <button onClick={() => { setIsAdminAuthenticated(false); setAdminPassword(''); if (allPackages.find(p => p.id === selectedPackage)) setSelectedPackage(''); }} className="text-[11px] text-slate-500 hover:text-slate-700">Sair</button>
                  </div>
                  {allPackages.map(pkg => {
                    const remainingHours = pkg.hours - pkg.usedHours;
                    const canUse = remainingHours >= duration / 60;
                    return (
                      <button key={pkg.id} type="button" onClick={() => canUse && setSelectedPackage(pkg.id)} disabled={!canUse}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${selectedPackage === pkg.id ? 'bg-amber-100 border border-amber-400' : canUse ? 'hover:bg-white border border-transparent' : 'opacity-40 cursor-not-allowed border border-transparent'}`}>
                        <p className="font-semibold text-slate-800">{pkg.type} <span className="text-xs text-amber-700">({customers.find(c => c.id === pkg.customerId)?.name || '-'})</span></p>
                        <p className="text-xs text-slate-500">{remainingHours.toFixed(1)}h de {pkg.hours}h</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-2xl font-bold text-emerald-600">
              {selectedPackage ? 'PACOTE' : `R$ ${totalValue.toFixed(2)}`}
            </span>
          </div>

          {/* Print */}
          {fiscalConfig?.enableFiscalPrint && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={printFiscalNote} onChange={(e) => setPrintFiscalNote(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
              <span className="text-sm text-slate-600">Imprimir comprovante</span>
            </label>
          )}

          {/* Payment Method */}
          {!selectedPackage && totalValue > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pix', 'credit', 'debit'] as const).map(method => (
                  <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-lg border text-center transition-all ${paymentMethod === method ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300'}`}>
                    <div className="text-xl mb-1">{method === 'pix' ? '�' : method === 'credit' ? '💳' : '�'}</div>
                    <div className="text-xs font-medium text-slate-700">{method === 'pix' ? 'PIX' : method === 'credit' ? 'Crédito' : 'Débito'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={handleCheckOut} disabled={loading || !child} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? '⏳ Processando...' : !child ? '⏳ Carregando...' : 'Confirmar Check-Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckOutModal;
