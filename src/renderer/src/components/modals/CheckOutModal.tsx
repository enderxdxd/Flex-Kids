import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
import { toast } from 'react-toastify';
import { Visit, Package, Child, Customer, FiscalConfig } from '../../../../shared/types';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';
import { paymentsServiceOffline } from '../../../../shared/firebase/services/payments.service.offline';
import { customersServiceOffline } from '../../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../../shared/services/bematech.service';
import { useUnit } from '../../contexts/UnitContext';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visit: Visit;
}

const ADMIN_PASSWORD = 'pactoflex123';
const KIDS_PLAN_FREE_MINUTES = 180; // 3 horas gratuitas por dia

const CheckOutModal: React.FC<CheckOutModalProps> = ({ isOpen, onClose, onSuccess, visit }) => {
  const { currentUnit } = useUnit();
  const [child, setChild] = useState<Child | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [usePackages, setUsePackages] = useState(false);
  const [selectedAdminPackage, setSelectedAdminPackage] = useState<string>('');
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
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (isOpen && visit) {
      loadData();
      calculateDuration();
    }
  }, [isOpen, visit]);

  const isKidsPlan = !!visit.kidsPlanId;

  useEffect(() => {
    calculateValue();
  }, [duration, usePackages, selectedAdminPackage, hourlyRate, minimumTime, packages, allPackages]);

  const loadData = async () => {
    try {
      const [childData, settings, allCustomers] = await Promise.all([
        customersServiceOffline.getChildById(visit.childId),
        settingsServiceOffline.getSettings(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
      ]);
      
      setCustomers(allCustomers);

      if (childData) {
        setChild(childData);
        const customerData = await customersServiceOffline.getCustomerById(childData.customerId);
        setCustomer(customerData);

        // Buscar pacotes ativos do cliente (filtrado pela unidade)
        const unitPackages = await packagesServiceOffline.getActivePackages(undefined, currentUnit);

        // Buscar todos os IDs de customer que pertencem ao mesmo responsável (por nome)
        // Isso resolve inconsistência de dados onde child.customerId != package.customerId
        const customerIds = new Set<string>();
        customerIds.add(childData.customerId);
        if (customerData?.name) {
          const normalizedName = customerData.name.toLowerCase().trim();
          allCustomers.forEach((c: any) => {
            if (c.name && c.name.toLowerCase().trim() === normalizedName) {
              customerIds.add(c.id);
            }
          });
        }

        const activePackages = unitPackages.filter(
          p => customerIds.has(p.customerId)
        );
        setPackages(activePackages);

        // Se o cliente tem pacote ativo com horas e NÃO é plano kids, ativar uso automático
        if (!isKidsPlan) {
          const hasAvailablePackage = activePackages.some(p => (p.hours - p.usedHours) > 0);
          if (hasAvailablePackage) {
            setUsePackages(true);
          }
        }
        
        // Guardar pacotes de outros clientes da mesma unidade para opção de admin
        const otherActivePackages = unitPackages.filter(
          p => !customerIds.has(p.customerId)
        );
        setAllPackages(otherActivePackages);
      } else {
        // Fallback: tenta buscar via getAllChildren
        console.warn('[CHECKOUT] Criança não encontrada via getChildById, tentando fallback...');
        const allChildren = await customersServiceOffline.getAllChildren(currentUnit);
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
      const fiscalSettings = await settingsServiceOffline.getFiscalConfig(currentUnit);
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
      const diffMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
      setDuration(diffMinutes);
    }
  };

  // Calcula cobertura de múltiplos pacotes (menor -> maior)
  const getMultiPackageCoverage = () => {
    // Determinar quais pacotes usar
    let pkgsToUse: Package[] = [];
    if (selectedAdminPackage) {
      const adminPkg = allPackages.find(p => p.id === selectedAdminPackage);
      if (adminPkg) pkgsToUse = [adminPkg];
    } else if (usePackages) {
      pkgsToUse = packages
        .filter(p => (p.hours - p.usedHours) > 0)
        .sort((a, b) => (a.hours - a.usedHours) - (b.hours - b.usedHours)); // menor primeiro
    }

    const billableMinutes = Math.max(duration, minimumTime);
    let remainingToCover = billableMinutes;
    const breakdown: { pkg: Package; coveredMin: number }[] = [];

    for (const pkg of pkgsToUse) {
      if (remainingToCover <= 0) break;
      const pkgRemainingMin = Math.round((pkg.hours - pkg.usedHours) * 60);
      const covered = Math.min(pkgRemainingMin, remainingToCover);
      if (covered > 0) {
        breakdown.push({ pkg, coveredMin: covered });
        remainingToCover -= covered;
      }
    }

    const totalCoveredMin = breakdown.reduce((sum, b) => sum + b.coveredMin, 0);
    const excessMin = Math.max(0, billableMinutes - totalCoveredMin);
    // Aplica tempo mínimo ao excedente (ex: 2min excedente → cobra 30min)
    const billableExcessMin = excessMin > 0 ? Math.max(excessMin, minimumTime) : 0;

    return {
      breakdown,
      totalCoveredMin,
      excessMin,
      billableExcessMin,
      isPartial: excessMin > 0 && totalCoveredMin > 0,
      isFullyCovered: excessMin === 0 && totalCoveredMin > 0,
      hasPackages: pkgsToUse.length > 0,
    };
  };

  // Calcula cobertura do Plano Kids (3h grátis/dia)
  const getKidsPlanCoverage = () => {
    const freeMin = KIDS_PLAN_FREE_MINUTES;
    const excessMin = Math.max(0, duration - freeMin);
    const coveredMin = Math.min(duration, freeMin);
    // Aplica tempo mínimo ao excedente (ex: 2min excedente → cobra 30min)
    const billableExcessMin = excessMin > 0 ? Math.max(excessMin, minimumTime) : 0;
    return { coveredMin, excessMin, billableExcessMin, isPartial: excessMin > 0, isFullyCovered: excessMin === 0 };
  };

  const calculateValue = () => {
    if (isKidsPlan) {
      const { billableExcessMin, isFullyCovered } = getKidsPlanCoverage();
      if (isFullyCovered) {
        setTotalValue(0);
        setPaymentMethod('package');
      } else {
        const excessHours = billableExcessMin / 60;
        const value = Math.max(excessHours * hourlyRate, hourlyRate);
        setTotalValue(Math.round(value * 100) / 100);
        if (paymentMethod === 'package') setPaymentMethod('pix');
      }
    } else if (usePackages || selectedAdminPackage) {
      const { billableExcessMin, isFullyCovered } = getMultiPackageCoverage();
      if (isFullyCovered) {
        setTotalValue(0);
        setPaymentMethod('package');
      } else if (billableExcessMin > 0) {
        const excessHours = billableExcessMin / 60;
        const value = Math.max(excessHours * hourlyRate, hourlyRate);
        setTotalValue(Math.round(value * 100) / 100);
        if (paymentMethod === 'package') setPaymentMethod('pix');
      }
    } else {
      // Cobrança por hora — aplica tempo mínimo
      const billableMinutes = Math.max(duration, minimumTime);
      const hours = billableMinutes / 60;
      const value = Math.max(hours * hourlyRate, hourlyRate);
      setTotalValue(Math.round(value * 100) / 100);
    }
  };

  const handleCheckOut = async () => {
    if (!isKidsPlan && !(usePackages || selectedAdminPackage) && paymentMethod === 'package') {
      toast.error('Selecione um pacote ou escolha outra forma de pagamento');
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      setLoading(true);

      if (isKidsPlan) {
        // --- Fluxo Plano Kids ---
        const kidsCoverage = getKidsPlanCoverage();

        // 1. Realizar checkout
        await visitsServiceOffline.checkOut({
          visitId: visit.id,
          duration,
          value: totalValue,
        });

        // 2. Se houver excedente, registrar pagamento
        if (totalValue > 0 && paymentMethod !== 'package' && customer && child) {
          const description = `Pagamento excedente Plano Kids - ${child.name} - ${kidsCoverage.excessMin}min excedente (${kidsCoverage.coveredMin}min grátis)`;

          console.log('[CHECKOUT] Criando pagamento Plano Kids:', {
            customerId: customer.id,
            childId: child.id,
            amount: totalValue,
            excessMin: kidsCoverage.excessMin,
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
            description,
          });
          console.log('[CHECKOUT] Pagamento Plano Kids criado:', payment.id);
        }
      } else {
        // --- Fluxo normal (pacotes / avulso) ---
        const coverage = getMultiPackageCoverage();
        const firstPkgId = coverage.breakdown.length > 0 ? coverage.breakdown[0].pkg.id : undefined;

        // 1. Realizar checkout
        await visitsServiceOffline.checkOut({
          visitId: visit.id,
          duration,
          value: totalValue,
          packageId: firstPkgId,
        });

        // 2. Descontar horas de cada pacote usado
        for (const { pkg, coveredMin } of coverage.breakdown) {
          const hoursToDeduct = coveredMin / 60;
          await packagesServiceOffline.usePackage(pkg.id, hoursToDeduct);
          console.log(`[CHECKOUT] Pacote ${pkg.type} (${pkg.id}): -${coveredMin}min`);
        }

        // 3. Se houver pagamento (excedente ou avulso), registrar
        if (totalValue > 0 && paymentMethod !== 'package' && customer && child) {
          const pkgDesc = coverage.breakdown.map(b => `${b.coveredMin}min de ${b.pkg.type}`).join(', ');
          const description = coverage.isPartial
            ? `Pagamento excedente visita - ${child.name} - ${coverage.excessMin}min excedente (${pkgDesc})`
            : `Pagamento visita - ${child.name} - ${duration} min`;

          console.log('[CHECKOUT] Criando pagamento:', {
            customerId: customer.id,
            childId: child.id,
            childName: child.name,
            amount: totalValue,
            partial: coverage.isPartial,
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
            description,
          });
          console.log('[CHECKOUT] Pagamento criado:', payment.id);
        }
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
        `PAGAMENTO: ${isKidsPlan ? 'PLANO KIDS' : (usePackages || selectedAdminPackage) ? 'PACOTE' : paymentMethod.toUpperCase()}`,
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
    setUsePackages(false);
    setSelectedAdminPackage('');
    setPaymentMethod('pix');
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    setShowConfirmation(false);
    onClose();
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
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
              {!isKidsPlan && !(usePackages || selectedAdminPackage) && duration < minimumTime && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tempo mínimo</span>
                  <span className="font-semibold text-amber-600">{formatTime(minimumTime)} (cobrado)</span>
                </div>
              )}
              {isKidsPlan && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Plano</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">Plano Kids — 3h grátis/dia</span>
                </div>
              )}
            </div>
          </div>

          {/* Packages - hide if KidsPlan */}
          {!isKidsPlan && packages.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Usar Pacotes</label>
              <div className="space-y-1">
                <button type="button" onClick={() => { setUsePackages(false); setSelectedAdminPackage(''); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${!usePackages && !selectedAdminPackage ? 'bg-violet-50 border border-violet-300' : 'hover:bg-slate-50 border border-transparent'}`}>
                  <p className="font-semibold text-slate-800">Pagamento Avulso</p>
                </button>
                <button type="button" onClick={() => { setUsePackages(true); setSelectedAdminPackage(''); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${usePackages ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50 border border-transparent'}`}>
                  <div>
                    <p className="font-semibold text-slate-800">Usar Pacotes do Cliente</p>
                    <p className="text-xs text-slate-500">Consome automaticamente do menor para o maior</p>
                  </div>
                </button>
                {usePackages && (
                  <div className="ml-3 pl-3 border-l-2 border-emerald-200 space-y-1">
                    {packages
                      .sort((a, b) => (a.hours - a.usedHours) - (b.hours - b.usedHours))
                      .map((pkg, idx) => {
                        const remainingHours = pkg.hours - pkg.usedHours;
                        const remainingMin = Math.round(remainingHours * 60);
                        const hasTime = remainingHours > 0;
                        const coverage = getMultiPackageCoverage();
                        const pkgCoverage = coverage.breakdown.find(b => b.pkg.id === pkg.id);
                        return (
                          <div key={pkg.id} className={`px-3 py-2 rounded-lg text-sm ${hasTime ? 'bg-white border border-slate-200' : 'bg-slate-50 border border-slate-100 opacity-50'}`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  <span className="text-xs text-slate-400 mr-1">#{idx + 1}</span>
                                  {pkg.type}
                                </p>
                                <p className="text-xs text-slate-500">{remainingMin}min restantes de {Math.round(pkg.hours * 60)}min</p>
                              </div>
                              {pkgCoverage ? (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">-{pkgCoverage.coveredMin}min</span>
                              ) : !hasTime ? (
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Esgotado</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Packages - hide if KidsPlan */}
          {!isKidsPlan && allPackages.length > 0 && (
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
                    <button onClick={() => { setIsAdminAuthenticated(false); setAdminPassword(''); setSelectedAdminPackage(''); }} className="text-[11px] text-slate-500 hover:text-slate-700">Sair</button>
                  </div>
                  {allPackages.map(pkg => {
                    const remainingHours = pkg.hours - pkg.usedHours;
                    const remainingMin = Math.round(remainingHours * 60);
                    const hasTime = remainingHours > 0;
                    return (
                      <button key={pkg.id} type="button" onClick={() => { if (hasTime) { setSelectedAdminPackage(pkg.id); setUsePackages(false); } }} disabled={!hasTime}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${selectedAdminPackage === pkg.id ? 'bg-amber-100 border border-amber-400' : hasTime ? 'hover:bg-white border border-transparent' : 'opacity-40 cursor-not-allowed border border-transparent'}`}>
                        <p className="font-semibold text-slate-800">{pkg.type} <span className="text-xs text-amber-700">({customers.find(c => c.id === pkg.customerId)?.name || '-'})</span></p>
                        <p className="text-xs text-slate-500">{remainingMin}min de {Math.round(pkg.hours * 60)}min</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Total */}
          {(() => {
            if (isKidsPlan) {
              const kidsCov = getKidsPlanCoverage();
              return (
                <div className={`rounded-lg p-4 border ${kidsCov.isPartial ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Plano Kids (grátis)</span>
                      <span className="font-semibold text-blue-600">{kidsCov.coveredMin}min</span>
                    </div>
                    {kidsCov.isPartial && (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Excedente</span>
                          <span className="font-semibold text-amber-600">{kidsCov.excessMin}min</span>
                        </div>
                        {kidsCov.billableExcessMin > kidsCov.excessMin && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">Tempo mínimo cobrado</span>
                            <span className="font-semibold text-amber-600">{kidsCov.billableExcessMin}min</span>
                          </div>
                        )}
                        <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Valor a pagar (excedente)</span>
                          <span className="text-xl font-bold text-amber-600">R$ {totalValue.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {kidsCov.isFullyCovered && (
                      <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-2xl font-bold text-blue-600">PLANO KIDS</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const coverage = (usePackages || selectedAdminPackage) ? getMultiPackageCoverage() : null;
            return (
              <div className={`rounded-lg p-4 border ${coverage?.isPartial ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {coverage && coverage.hasPackages && (coverage.isPartial || coverage.isFullyCovered) ? (
                  <div className="space-y-2">
                    {coverage.breakdown.map((b) => (
                      <div key={b.pkg.id} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{b.pkg.type}</span>
                        <span className="font-semibold text-emerald-600">-{b.coveredMin}min</span>
                      </div>
                    ))}
                    {coverage.isPartial && (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Excedente</span>
                          <span className="font-semibold text-amber-600">{coverage.excessMin}min</span>
                        </div>
                        {coverage.billableExcessMin > coverage.excessMin && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">Tempo mínimo cobrado</span>
                            <span className="font-semibold text-amber-600">{coverage.billableExcessMin}min</span>
                          </div>
                        )}
                        <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Valor a pagar (excedente)</span>
                          <span className="text-xl font-bold text-amber-600">R$ {totalValue.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {coverage.isFullyCovered && (
                      <div className="border-t border-emerald-200 pt-2 flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">Total</span>
                        <span className="text-2xl font-bold text-emerald-600">PACOTE</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Total</span>
                    <span className="text-2xl font-bold text-emerald-600">R$ {totalValue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Print */}
          {fiscalConfig?.enableFiscalPrint && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={printFiscalNote} onChange={(e) => setPrintFiscalNote(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
              <span className="text-sm text-slate-600">Imprimir comprovante</span>
            </label>
          )}

          {/* Payment Method */}
          {totalValue > 0 && paymentMethod !== 'package' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {(['pix', 'credit', 'debit'] as const).map(method => (
                  <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-lg border text-center transition-all ${paymentMethod === method ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300'}`}>
                    <div className="text-xl mb-1">{method === 'pix' ? '⚡' : method === 'credit' ? '💳' : '💳'}</div>
                    <div className="text-xs font-medium text-slate-700">{method === 'pix' ? 'PIX' : method === 'credit' ? 'Crédito' : 'Débito'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          {!showConfirmation ? (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button type="button" onClick={() => {
                if (!isKidsPlan && !(usePackages || selectedAdminPackage) && paymentMethod === 'package') {
                  toast.error('Selecione um pacote ou escolha outra forma de pagamento');
                  return;
                }
                setShowConfirmation(true);
              }} disabled={loading || !child} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {loading ? '⏳ Processando...' : !child ? '⏳ Carregando...' : 'Confirmar Check-Out'}
              </button>
            </div>
          ) : (
            <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-bold text-amber-800 text-center">Confirme os dados do check-out:</p>
              <div className="text-xs text-slate-700 space-y-1">
                <p><span className="font-semibold">Criança:</span> {child?.name}</p>
                <p><span className="font-semibold">Duração:</span> {Math.floor(duration / 60)}h {duration % 60}min</p>
                {(() => {
                  if (isKidsPlan) {
                    const kidsCov = getKidsPlanCoverage();
                    if (kidsCov.isFullyCovered) {
                      return <p><span className="font-semibold">Pagamento:</span> <span className="text-blue-700 font-bold">Plano Kids ({kidsCov.coveredMin}min grátis)</span></p>;
                    } else {
                      return (
                        <>
                          <p><span className="font-semibold">Plano Kids:</span> <span className="text-blue-700 font-bold">{kidsCov.coveredMin}min grátis</span></p>
                          <p><span className="font-semibold">Excedente:</span> <span className="text-amber-700 font-bold">{kidsCov.excessMin}min{kidsCov.billableExcessMin > kidsCov.excessMin ? ` (mín. ${kidsCov.billableExcessMin}min)` : ''} → R$ {totalValue.toFixed(2)}</span></p>
                          <p><span className="font-semibold">Forma:</span> {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'Crédito' : 'Débito'}</p>
                        </>
                      );
                    }
                  }
                  const coverage = (usePackages || selectedAdminPackage) ? getMultiPackageCoverage() : null;
                  if (coverage?.isFullyCovered) {
                    return (
                      <>
                        <p><span className="font-semibold">Pagamento:</span> <span className="text-violet-700 font-bold">Via Pacote</span></p>
                        {coverage.breakdown.map(b => (
                          <p key={b.pkg.id} className="text-[11px] text-slate-500 ml-2">• {b.pkg.type}: -{b.coveredMin}min</p>
                        ))}
                      </>
                    );
                  } else if (coverage?.isPartial) {
                    return (
                      <>
                        {coverage.breakdown.map(b => (
                          <p key={b.pkg.id}><span className="font-semibold">{b.pkg.type}:</span> <span className="text-emerald-700 font-bold">-{b.coveredMin}min</span></p>
                        ))}
                        <p><span className="font-semibold">Excedente:</span> <span className="text-amber-700 font-bold">{coverage.excessMin}min{coverage.billableExcessMin > coverage.excessMin ? ` (mín. ${coverage.billableExcessMin}min)` : ''} → R$ {totalValue.toFixed(2)}</span></p>
                        <p><span className="font-semibold">Forma:</span> {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'Crédito' : 'Débito'}</p>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <p><span className="font-semibold">Valor:</span> <span className="text-emerald-700 font-bold">R$ {totalValue.toFixed(2)}</span></p>
                        <p><span className="font-semibold">Forma:</span> {paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'Crédito' : 'Débito'}</p>
                      </>
                    );
                  }
                })()}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowConfirmation(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Voltar</button>
                <button type="button" onClick={handleCheckOut} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  {loading ? '⏳ Processando...' : '✅ Confirmar Pagamento'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

export default CheckOutModal;
