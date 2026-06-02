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
import {
  KIDS_PLAN_FREE_MINUTES,
  calculateKidsPlanCoverage,
  calculateMultiPackageCoverage,
  calculatePrincipalValue,
  calculateSiblingAvulsoValue,
  distributeSiblingCoverageOverPackage,
  recalcDurationMinutes,
} from '../../../../shared/utils/billing';

interface SiblingVisit {
  visit: Visit;
  child: Child;
  duration: number;
  value: number;
  included: boolean;
}

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visit: Visit;
  activeVisits?: Visit[];
}

const ADMIN_PASSWORD = 'pactoflex123';

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
  const [employeeDiscount, setEmployeeDiscount] = useState(false);
  const [siblingVisits, setSiblingVisits] = useState<SiblingVisit[]>([]);

  useEffect(() => {
    if (isOpen && visit) {
      loadData();
      calculateDuration();
    }
  }, [isOpen, visit]);

  const isKidsPlan = !!visit.kidsPlanId;

  useEffect(() => {
    calculateValue();
  }, [duration, usePackages, selectedAdminPackage, hourlyRate, minimumTime, packages, allPackages, employeeDiscount, siblingVisits]);

  const loadData = async () => {
    try {
      const [childData, settings, allCustomers] = await Promise.all([
        customersServiceOffline.getChildById(visit.childId),
        settingsServiceOffline.getSettings(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
      ]);
      
      setCustomers(allCustomers);

      const relatedCustomerIds = new Set<string>();

      if (childData) {
        setChild(childData);
        const customerData = await customersServiceOffline.getCustomerById(childData.customerId);
        setCustomer(customerData);

        // Buscar pacotes ativos do cliente (filtrado pela unidade)
        const unitPackages = await packagesServiceOffline.getActivePackages(undefined, currentUnit);

        // Buscar todos os IDs de customer que pertencem ao mesmo responsável (por nome)
        // Isso resolve inconsistência de dados onde child.customerId != package.customerId
        relatedCustomerIds.add(childData.customerId);
        if (customerData?.name) {
          const normalizedName = customerData.name.toLowerCase().trim();
          allCustomers.forEach((c: any) => {
            if (c.name && c.name.toLowerCase().trim() === normalizedName) {
              relatedCustomerIds.add(c.id);
            }
          });
        }

        const activePackages = unitPackages.filter(
          p => relatedCustomerIds.has(p.customerId)
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
          p => !relatedCustomerIds.has(p.customerId)
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

      const rate = settings.hourlyRate || 30;
      const minTime = settings.minimumTime || 30;
      setHourlyRate(rate);
      setMinimumTime(minTime);

      // Detectar visitas de irmãos (mesmo responsável, crianças diferentes)
      // IMPORTANTE: re-buscar visitas ativas do storage (não confiar no prop, que pode estar stale)
      if (childData) {
        const freshActiveVisits = await visitsServiceOffline.getActiveVisits(currentUnit);
        const customerChildren = await customersServiceOffline.getAllChildren(currentUnit);

        const siblingActiveVisits = freshActiveVisits.filter(v => {
          if (v.id === visit.id) return false;
          // garantir que realmente está sem check-out
          if (v.checkOut) return false;
          // resolver customerId mesmo se child não estiver enriquecido
          const sibChild = v.child ?? customerChildren.find(c => c.id === v.childId);
          if (!sibChild) return false;
          return relatedCustomerIds.has(sibChild.customerId);
        });

        if (siblingActiveVisits.length > 0) {
          const siblings: SiblingVisit[] = siblingActiveVisits.map(sv => {
            const sibChild = (sv.child ?? customerChildren.find(c => c.id === sv.childId))!;
            const checkInTime = sv.checkIn instanceof Date ? sv.checkIn : new Date(sv.checkIn);
            const dur = Math.max(0, Math.ceil((Date.now() - checkInTime.getTime()) / (1000 * 60)));
            return {
              visit: sv,
              child: sibChild,
              duration: dur,
              value: 0, // recalculado dinamicamente em calculateValue
              included: false, // padrão: NÃO incluir; usuário precisa habilitar conscientemente
            };
          });
          setSiblingVisits(siblings);
          console.log(`[CHECKOUT] Encontrados ${siblings.length} irmão(s) com visitas ativas (não incluídos por padrão)`);
        } else {
          setSiblingVisits([]);
        }
      } else {
        setSiblingVisits([]);
      }

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

  // Determina quais pacotes estão ativos para este checkout (admin escolhido OU pacotes do cliente)
  const selectedPackages = (): Package[] => {
    if (selectedAdminPackage) {
      const adminPkg = allPackages.find(p => p.id === selectedAdminPackage);
      return adminPkg ? [adminPkg] : [];
    }
    if (usePackages) return packages;
    return [];
  };

  // Wrappers thin que fecham sobre o estado e delegam para src/shared/utils/billing.ts
  const getMultiPackageCoverage = (extraMinutes = 0, durationOverride?: number) =>
    calculateMultiPackageCoverage(
      selectedPackages(),
      durationOverride ?? duration,
      minimumTime,
      extraMinutes,
    );

  const getKidsPlanCoverage = (durationOverride?: number) =>
    calculateKidsPlanCoverage(durationOverride ?? duration, minimumTime, KIDS_PLAN_FREE_MINUTES);

  // Reexport para callsites antigos (mantém compatibilidade do nome)
  const recalcDurationFromCheckIn = (checkIn: Date | string | undefined): number =>
    recalcDurationMinutes(checkIn);

  // Quantidade de pacotes do cliente com saldo positivo (para aviso de "avulso com pacote disponível")
  const customerPackagesWithBalance = packages.filter(p => (p.hours - p.usedHours) > 0);
  const customerHasAvailablePackage = !isKidsPlan && customerPackagesWithBalance.length > 0;
  const isPayingAvulsoDespitePackage = customerHasAvailablePackage && !usePackages && !selectedAdminPackage;

  const calculateValue = () => {
    // Calcular minutos faturáveis dos irmãos incluídos (exceto Kids Plan)
    const includedSiblings = siblingVisits.filter(s => s.included && !s.visit.kidsPlanId);
    const siblingsBillableMin = includedSiblings.reduce(
      (sum, s) => sum + Math.max(s.duration, minimumTime), 0
    );

    if (isKidsPlan) {
      const { billableExcessMin, isFullyCovered } = getKidsPlanCoverage();
      if (isFullyCovered) {
        setTotalValue(0);
        setPaymentMethod('package');
      } else {
        const excessHours = billableExcessMin / 60;
        const value = excessHours * hourlyRate;
        setTotalValue(Math.round(value * 100) / 100);
        if (paymentMethod === 'package') setPaymentMethod('pix');
      }
      // Irmãos do Kids Plan: cobrar avulso (não usam o plano kids do irmão)
      setSiblingVisits(prev => prev.map(s => ({
        ...s,
        value: s.visit.kidsPlanId ? 0 : Math.round((Math.max(s.duration, minimumTime) / 60) * hourlyRate * 100) / 100,
      })));
    } else if (usePackages || selectedAdminPackage) {
      // Pacote cobre principal + irmãos incluídos
      const coverage = getMultiPackageCoverage(siblingsBillableMin);
      if (coverage.isFullyCovered) {
        setTotalValue(0);
        setPaymentMethod('package');
        // Todos cobertos pelo pacote → valor 0
        setSiblingVisits(prev => prev.map(s => ({ ...s, value: 0 })));
      } else if (coverage.excessMin > 0) {
        // Pacote cobriu parte. Distribuir: principal primeiro, depois irmãos
        const principalCovered = Math.min(coverage.totalCoveredMin, coverage.principalBillable);
        const principalExcess = coverage.principalBillable - principalCovered;
        const principalValue = principalExcess > 0
          ? Math.round((Math.max(principalExcess, minimumTime) / 60) * hourlyRate * 100) / 100
          : 0;
        setTotalValue(principalValue);
        if (principalValue > 0 && paymentMethod === 'package') setPaymentMethod('pix');

        // Restante do pacote para irmãos
        let remainingPkgMin = Math.max(0, coverage.totalCoveredMin - principalCovered);
        setSiblingVisits(prev => prev.map(s => {
          if (!s.included || s.visit.kidsPlanId) return { ...s, value: s.visit.kidsPlanId ? 0 : s.value };
          const sibBillable = Math.max(s.duration, minimumTime);
          const sibCovered = Math.min(remainingPkgMin, sibBillable);
          remainingPkgMin -= sibCovered;
          const sibExcess = sibBillable - sibCovered;
          const sibVal = sibExcess > 0
            ? Math.round((Math.max(sibExcess, minimumTime) / 60) * hourlyRate * 100) / 100
            : 0;
          return { ...s, value: sibVal };
        }));
      } else {
        setTotalValue(0);
        setPaymentMethod('package');
        setSiblingVisits(prev => prev.map(s => ({ ...s, value: 0 })));
      }
    } else {
      // Cobrança por hora — primeiros N min (tempo mínimo) cobram cheio, depois por minuto
      const billableMinutes = Math.max(duration, minimumTime);
      const hours = billableMinutes / 60;
      let value = hours * hourlyRate;
      if (employeeDiscount) value *= 0.5;
      setTotalValue(Math.round(value * 100) / 100);
      // Irmãos avulso
      setSiblingVisits(prev => prev.map(s => ({
        ...s,
        value: s.visit.kidsPlanId ? 0 : Math.round((Math.max(s.duration, minimumTime) / 60) * hourlyRate * (employeeDiscount ? 0.5 : 1) * 100) / 100,
      })));
    }
  };

  // Total dos irmãos incluídos
  const includedSiblingsTotal = siblingVisits
    .filter(s => s.included)
    .reduce((sum, s) => sum + s.value, 0);

  const combinedTotal = Math.round((totalValue + includedSiblingsTotal) * 100) / 100;

  const toggleSibling = (visitId: string) => {
    setSiblingVisits(prev => prev.map(s =>
      s.visit.id === visitId ? { ...s, included: !s.included } : s
    ));
  };

  const setAllSiblingsIncluded = (included: boolean) => {
    setSiblingVisits(prev => prev.map(s => ({ ...s, included })));
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

      // === Recalcular durações no momento do checkout para evitar drift se modal ficou aberto ===
      const actualDuration = recalcDurationFromCheckIn(visit.checkIn);
      const freshSiblings: SiblingVisit[] = siblingVisits.map(s => ({
        ...s,
        duration: recalcDurationFromCheckIn(s.visit.checkIn),
      }));

      if (isKidsPlan) {
        // --- Fluxo Plano Kids ---
        const kidsCoverage = getKidsPlanCoverage(actualDuration);
        const actualValue = calculatePrincipalValue({
          isKidsPlan: true,
          usePackages: false,
          durationMin: actualDuration,
          minimumTime,
          hourlyRate,
          kidsCoverage,
        });

        let paymentId: string | undefined;

        // 1. Se houver excedente, registrar pagamento
        if (actualValue > 0 && paymentMethod !== 'package' && customer && child) {
          const description = `Pagamento excedente Plano Kids - ${child.name} - ${kidsCoverage.excessMin}min excedente (${kidsCoverage.coveredMin}min grátis)`;

          console.log('[CHECKOUT] Criando pagamento Plano Kids:', {
            customerId: customer.id,
            childId: child.id,
            amount: actualValue,
            excessMin: kidsCoverage.excessMin,
            actualDuration,
          });

          const payment = await paymentsServiceOffline.createPayment({
            customerId: customer.id,
            childId: child.id,
            childName: child.name,
            amount: actualValue,
            method: paymentMethod,
            status: 'paid',
            type: 'visit',
            unitId: visit.unitId,
            description,
          });
          console.log('[CHECKOUT] Pagamento Plano Kids criado:', payment.id);
          paymentId = payment.id;
        }

        // 2. Realizar checkout com os metadados de quitação
        await visitsServiceOffline.checkOut({
          visitId: visit.id,
          duration: actualDuration,
          value: actualValue,
          paymentMethod: actualValue > 0 ? paymentMethod : 'kids_plan',
          paid: true,
          paymentId,
        });
      } else {
        // --- Fluxo normal (pacotes / avulso) ---
        // Calcular cobertura incluindo irmãos para descontar corretamente do pacote
        const includedSibsFresh = freshSiblings.filter(s => s.included && !s.visit.kidsPlanId);
        const sibsBillable = includedSibsFresh.reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);
        const coverage = getMultiPackageCoverage(sibsBillable, actualDuration);
        const firstPkgId = coverage.breakdown.length > 0 ? coverage.breakdown[0].pkg.id : undefined;

        // Recomputar valor principal com duração atual (delegado para billing.ts)
        const actualValue = calculatePrincipalValue({
          isKidsPlan: false,
          usePackages: usePackages || !!selectedAdminPackage,
          durationMin: actualDuration,
          minimumTime,
          hourlyRate,
          employeeDiscount,
          multiCoverage: coverage,
        });

        // 2. Descontar horas de cada pacote usado (inclui principal + irmãos)
        for (const { pkg, coveredMin } of coverage.breakdown) {
          const hoursToDeduct = coveredMin / 60;
          await packagesServiceOffline.usePackage(pkg.id, hoursToDeduct);
          console.log(`[CHECKOUT] Pacote ${pkg.type} (${pkg.id}): -${coveredMin}min (principal+irmãos)`);
        }

        let paymentId: string | undefined;

        // 3. Se houver pagamento (excedente ou avulso), registrar para o principal
        if (actualValue > 0 && paymentMethod !== 'package' && customer && child) {
          const pkgDesc = coverage.breakdown.map(b => `${b.coveredMin}min de ${b.pkg.type}`).join(', ');
          const description = coverage.isPartial
            ? `Pagamento excedente visita - ${child.name} - ${coverage.excessMin}min excedente (${pkgDesc})`
            : `Pagamento visita - ${child.name} - ${actualDuration} min${employeeDiscount ? ' (desconto colaborador 50%)' : ''}`;

          console.log('[CHECKOUT] Criando pagamento:', {
            customerId: customer.id,
            childId: child.id,
            childName: child.name,
            amount: actualValue,
            partial: coverage.isPartial,
            actualDuration,
          });

          const payment = await paymentsServiceOffline.createPayment({
            customerId: customer.id,
            childId: child.id,
            childName: child.name,
            amount: actualValue,
            method: paymentMethod,
            status: 'paid',
            type: 'visit',
            unitId: visit.unitId,
            description,
          });
          console.log('[CHECKOUT] Pagamento criado:', payment.id);
          paymentId = payment.id;
        }

        await visitsServiceOffline.checkOut({
          visitId: visit.id,
          duration: actualDuration,
          value: actualValue,
          paymentMethod: actualValue > 0 ? paymentMethod : 'package',
          paid: true,
          paymentId,
          packageId: firstPkgId,
        });
      }

      // 4. Processar checkout dos irmãos incluídos com durações ATUALIZADAS (via billing.ts)
      const includedSiblings = freshSiblings.filter(s => s.included);

      // Pré-calcular valores e flag de pacote por irmão (distribui sobra do pacote, trata Kids Plan)
      const sibCalcs: { sibValue: number; sibUsedPackage: boolean }[] = (() => {
        if (isKidsPlan || !(usePackages || selectedAdminPackage)) {
          // Sem pacote do principal → cada irmão calculado individualmente
          return includedSiblings.map(s => {
            if (s.visit.kidsPlanId) {
              const kc = getKidsPlanCoverage(s.duration);
              return {
                sibValue: kc.billableExcessMin > 0
                  ? Math.round((kc.billableExcessMin / 60) * hourlyRate * 100) / 100
                  : 0,
                sibUsedPackage: false,
              };
            }
            return {
              sibValue: calculateSiblingAvulsoValue(s.duration, minimumTime, hourlyRate, employeeDiscount),
              sibUsedPackage: false,
            };
          });
        }

        // Com pacote ativo: precisa recalcular cobertura para distribuir sobra entre irmãos
        const includedSibsNonKids = includedSiblings.filter(s => !s.visit.kidsPlanId);
        const sibsBill = includedSibsNonKids.reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);
        const cov = getMultiPackageCoverage(sibsBill, actualDuration);
        return distributeSiblingCoverageOverPackage(
          cov,
          includedSiblings.map(s => ({ durationMin: s.duration, isKidsPlan: !!s.visit.kidsPlanId })),
          minimumTime,
          hourlyRate,
          employeeDiscount,
        );
      })();

      const pkgFirstId: string | undefined = (() => {
        if (isKidsPlan || !(usePackages || selectedAdminPackage) || includedSiblings.length === 0) return undefined;
        const includedSibsNonKids = includedSiblings.filter(s => !s.visit.kidsPlanId);
        const sibsBill = includedSibsNonKids.reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);
        return getMultiPackageCoverage(sibsBill, actualDuration).breakdown[0]?.pkg.id;
      })();

      for (let i = 0; i < includedSiblings.length; i++) {
        const sibling = includedSiblings[i];
        const { sibValue, sibUsedPackage } = sibCalcs[i];
        const sibPkgId = sibUsedPackage ? pkgFirstId : undefined;
        let siblingPaymentId: string | undefined;

        // Registrar pagamento do irmão somente se houver valor a pagar
        if (sibValue > 0 && customer) {
          const sibDescription = `Pagamento visita - ${sibling.child.name} - ${sibling.duration} min`;
          const siblingPayment = await paymentsServiceOffline.createPayment({
            customerId: customer.id,
            childId: sibling.child.id,
            childName: sibling.child.name,
            amount: sibValue,
            method: paymentMethod,
            status: 'paid',
            type: 'visit',
            unitId: visit.unitId,
            description: sibDescription,
          });
          siblingPaymentId = siblingPayment.id;
          console.log(`[CHECKOUT] Pagamento irmão ${sibling.child.name} criado: R$${sibValue.toFixed(2)}`);
        }
        await visitsServiceOffline.checkOut({
          visitId: sibling.visit.id,
          duration: sibling.duration,
          value: sibValue,
          paymentMethod: sibValue > 0 ? paymentMethod : sibling.visit.kidsPlanId ? 'kids_plan' : 'package',
          paid: true,
          paymentId: siblingPaymentId,
          packageId: sibPkgId,
        });
        console.log(`[CHECKOUT] Irmão ${sibling.child.name} checkout: ${sibling.duration}min, R$${sibValue.toFixed(2)}${sibPkgId ? ' (pacote)' : ''}`);
      }

      // 5. Emitir nota fiscal se habilitado — usar duração/valor recalculados (via billing.ts)
      const fiscalDuration = actualDuration;
      const fiscalValue = (() => {
        const includedSibsNonKids = freshSiblings.filter(s => s.included && !s.visit.kidsPlanId);
        const sibsBill = includedSibsNonKids.reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);
        return calculatePrincipalValue({
          isKidsPlan,
          usePackages: usePackages || !!selectedAdminPackage,
          durationMin: actualDuration,
          minimumTime,
          hourlyRate,
          employeeDiscount,
          multiCoverage: !isKidsPlan ? getMultiPackageCoverage(sibsBill, actualDuration) : undefined,
          kidsCoverage: isKidsPlan ? getKidsPlanCoverage(actualDuration) : undefined,
        });
      })();

      let printSuccess = true;
      console.log('[CHECKOUT] Verificando impressão fiscal:');
      console.log('[CHECKOUT] - printFiscalNote:', printFiscalNote);
      console.log('[CHECKOUT] - enableFiscalPrint:', fiscalConfig?.enableFiscalPrint);
      console.log('[CHECKOUT] - child:', !!child);

      // Só precisa de child para imprimir, customer é opcional
      if (printFiscalNote && fiscalConfig?.enableFiscalPrint && child) {
        console.log('[CHECKOUT] Condições atendidas, chamando handleFiscalNote...');
        const printSiblings = includedSiblings.map((s, i) => ({
          childName: s.child.name,
          duration: s.duration,
          value: sibCalcs[i].sibValue,
        }));
        printSuccess = await handleFiscalNote(fiscalDuration, fiscalValue, printSiblings);
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
      processingRef.current = false;
      setLoading(false);
    }
  };

  const handleFiscalNote = async (
    durationOverride?: number,
    totalValueOverride?: number,
    siblings?: { childName: string; duration: number; value: number }[],
  ): Promise<boolean> => {
    if (!child || !fiscalConfig) return false;

    const printDuration = durationOverride ?? duration;
    const printValue = totalValueOverride ?? totalValue;
    const includedSibs = siblings?.filter(s => s.duration > 0) || [];
    const combinedTotal = printValue + includedSibs.reduce((sum, s) => sum + s.value, 0);

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

      // Imprimir cupom não-fiscal com irmãos incluídos
      const lines = [
        '================================',
        `CRIANCA: ${child.name}`,
        ...(child.cpf ? [`CPF: ${child.cpf}`] : []),
        `RESPONSAVEL: ${customer?.name || 'N/A'}`,
        '',
        `ENTRADA: ${formatTime(checkInTime)}`,
        `SAIDA: ${formatTime(checkOutTime)}`,
        `DURACAO: ${Math.floor(printDuration / 60)}h ${printDuration % 60}min`,
        `VALOR: R$ ${printValue.toFixed(2)}`,
        ...(includedSibs.length > 0 ? [
          '',
          '--- IRMAOS INCLUIDOS ---',
          ...includedSibs.flatMap(s => [
            `CRIANCA: ${s.childName}`,
            `DURACAO: ${Math.floor(s.duration / 60)}h ${s.duration % 60}min`,
            `VALOR: R$ ${s.value.toFixed(2)}`,
            '',
          ]),
          '--------------------------------',
          `TOTAL GERAL: R$ ${combinedTotal.toFixed(2)}`,
        ] : [
          '',
          `VALOR TOTAL: R$ ${printValue.toFixed(2)}`,
        ]),
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
    setEmployeeDiscount(false);
    setSiblingVisits([]);
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
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
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

          {/* Visitas de Irmãos */}
          {siblingVisits.length > 0 && (
            <div className="border border-violet-200 rounded-lg p-4 bg-violet-50/50">
              <p className="text-xs font-bold text-violet-800 mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                Irmãos com visita ativa ({siblingVisits.length})
              </p>
              <p className="text-[11px] text-violet-700/70 mb-2.5">
                Marque apenas os irmãos que você quer fechar junto neste check-out.
              </p>
              <div className="flex gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => setAllSiblingsIncluded(true)}
                  className="px-2.5 py-1 rounded-md border border-violet-200 bg-white text-[11px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setAllSiblingsIncluded(false)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Limpar seleção
                </button>
              </div>
              <div className="space-y-1.5">
                {siblingVisits.map((sibling) => (
                  <label key={sibling.visit.id} className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border transition-all ${sibling.included ? 'bg-white border-violet-300' : 'bg-white/60 border-slate-200 hover:border-violet-300'}`}>
                    <input
                      type="checkbox"
                      checked={sibling.included}
                      onChange={() => toggleSibling(sibling.visit.id)}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${sibling.included ? 'text-slate-800' : 'text-slate-500'}`}>{sibling.child.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatTime(sibling.duration)}
                        {sibling.included && (sibling.value > 0 ? ` · R$ ${sibling.value.toFixed(2)}` : sibling.visit.kidsPlanId ? ' · Plano Kids' : ' · Pacote')}
                        {!sibling.included && ' · não será cobrado'}
                      </p>
                    </div>
                    {sibling.included && (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">Incluído</span>
                    )}
                  </label>
                ))}
              </div>
              {includedSiblingsTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-violet-200 flex justify-between items-center text-sm">
                  <span className="text-violet-700 font-medium">Subtotal irmãos</span>
                  <span className="font-bold text-violet-700">R$ {includedSiblingsTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Packages - hide if KidsPlan */}
          {!isKidsPlan && packages.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Usar Pacotes</label>
              {isPayingAvulsoDespitePackage && (
                <div className="mb-2 border-2 border-orange-300 bg-orange-50 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-orange-800">Atenção: cliente tem pacote com saldo</p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      {customerPackagesWithBalance.length} pacote(s) disponível(is) — total {Math.round(customerPackagesWithBalance.reduce((s, p) => s + (p.hours - p.usedHours) * 60, 0))}min. Confirme se realmente deseja cobrar avulso.
                    </p>
                  </div>
                </div>
              )}
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

          {/* Employee Discount */}
          {!isKidsPlan && !usePackages && !selectedAdminPackage && (
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
              <div className="relative">
                <input type="checkbox" checked={employeeDiscount} onChange={(e) => setEmployeeDiscount(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-violet-500 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-700">Desconto Colaborador</span>
                <span className="text-xs text-slate-400 ml-1.5">(50%)</span>
              </div>
            </label>
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
                  <div>
                    {employeeDiscount && (
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-500">Desconto colaborador (50%)</span>
                        <span className="text-slate-400 line-through">R$ {(totalValue * 2).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">Total</span>
                      <span className="text-2xl font-bold text-emerald-600">R$ {totalValue.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Total Combinado (principal + irmãos) */}
          {siblingVisits.filter(s => s.included).length > 0 && (
            <div className="rounded-lg p-4 border-2 border-violet-300 bg-violet-50">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">{child?.name || 'Principal'}</span>
                  <span className="font-semibold text-slate-700">R$ {totalValue.toFixed(2)}</span>
                </div>
                {siblingVisits.filter(s => s.included).map(s => (
                  <div key={s.visit.id} className="flex justify-between items-center">
                    <span className="text-slate-600">{s.child.name}</span>
                    <span className="font-semibold text-slate-700">{s.value > 0 ? `R$ ${s.value.toFixed(2)}` : s.visit.kidsPlanId ? 'Plano Kids' : 'Pacote'}</span>
                  </div>
                ))}
                <div className="border-t border-violet-300 pt-2 flex justify-between items-center">
                  <span className="font-bold text-violet-800">Total Geral</span>
                  <span className="text-2xl font-bold text-violet-700">R$ {combinedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

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
                    <div className="flex justify-center mb-1">{method === 'pix' ? <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}</div>
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
              {isPayingAvulsoDespitePackage && (
                <div className="border-2 border-orange-400 bg-orange-100 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-orange-900">Você está cobrando AVULSO com pacote disponível!</p>
                    <p className="text-[11px] text-orange-800 mt-0.5">
                      Cliente tem {Math.round(customerPackagesWithBalance.reduce((s, p) => s + (p.hours - p.usedHours) * 60, 0))}min em {customerPackagesWithBalance.length} pacote(s). Volte e selecione "Usar Pacotes do Cliente" se for engano.
                    </p>
                  </div>
                </div>
              )}
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
                {siblingVisits.filter(s => s.included).length > 0 && (
                  <>
                    <div className="border-t border-amber-300 mt-2 pt-2">
                      <p className="font-semibold text-violet-800">Irmãos incluídos:</p>
                    </div>
                    {siblingVisits.filter(s => s.included).map(s => (
                      <p key={s.visit.id}><span className="font-semibold">{s.child.name}:</span> {formatTime(s.duration)} — <span className="text-emerald-700 font-bold">R$ {s.value.toFixed(2)}</span></p>
                    ))}
                    <div className="border-t border-amber-300 mt-1 pt-1">
                      <p><span className="font-bold text-violet-800">Total Geral:</span> <span className="text-lg font-bold text-violet-700">R$ {combinedTotal.toFixed(2)}</span></p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowConfirmation(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Voltar</button>
                <button type="button" onClick={handleCheckOut} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  {loading ? 'Processando...' : 'Confirmar Pagamento'}
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
