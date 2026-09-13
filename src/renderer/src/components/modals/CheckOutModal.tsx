import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
import { toast } from 'react-toastify';
import { Visit, Package, Child, Customer, FiscalConfig } from '../../../../shared/types';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { packagesServiceOffline, PackageDeductionUndo } from '../../../../shared/firebase/services/packages.service.offline';
import { paymentsServiceOffline } from '../../../../shared/firebase/services/payments.service.offline';
import { customersServiceOffline } from '../../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../../shared/services/bematech.service';
import { useUnit } from '../../contexts/UnitContext';
import { getPackageExpiryDate } from '../../../../shared/utils/packageExpiry';
import { formatBRL } from '../../../../shared/utils/currency';
import {
  KIDS_PLAN_FREE_MINUTES,
  calculateIncludedSiblingValues,
  calculateKidsPlanCoverage,
  calculateMultiPackageCoverage,
  calculatePrincipalValue,
  recalcDurationMinutes,
} from '../../../../shared/utils/billing';

interface SiblingVisit {
  visit: Visit;
  child: Child;
  duration: number;
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

/**
 * Acima disso a permanência é sinalizada no modal: numa recreação infantil uma
 * visita de 6h+ quase sempre é check-out esquecido, e o operador precisa
 * conferir o horário antes de cobrar.
 */
const LONG_VISIT_ALERT_MINUTES = 6 * 60;

/** Indicador de seleção de um item de radiogroup. */
const RadioDot: React.FC<{ checked: boolean; tone?: 'brand' | 'emerald' }> = ({ checked, tone = 'brand' }) => {
  const ring = checked
    ? tone === 'emerald' ? 'border-state-ok' : 'border-brand-500'
    : 'border-line-strong';
  const dot = tone === 'emerald' ? 'bg-state-ok' : 'bg-brand-500';
  return (
    <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${ring}`}>
      {checked && <span className={`w-2 h-2 rounded-full ${dot}`} />}
    </span>
  );
};

/**
 * Saldo de um pacote como medidor de três faixas — já usado · sai agora · sobra.
 * É o que diferencia dois pacotes de mesmo nome e deixa visível quando um deles
 * vai zerar neste check-out; o número sozinho não mostra isso.
 */
const PackageBalanceRow: React.FC<{ pkg: Package; consumingMin: number }> = ({ pkg, consumingMin }) => {
  const totalMin = Math.round(pkg.hours * 60);
  const remainingMin = Math.max(0, Math.round((pkg.hours - pkg.usedHours) * 60));
  const consuming = Math.min(consumingMin, remainingMin);
  const leftAfterMin = remainingMin - consuming;
  const isEmpty = remainingMin <= 0;

  const pct = (min: number) => (totalMin > 0 ? (min / totalMin) * 100 : 0);
  const leftAfterPct = pct(leftAfterMin);
  // Cor da sobra segue o mesmo semáforo da tela de Pacotes.
  const leftTone = leftAfterPct <= 10 ? 'bg-state-bad' : leftAfterPct <= 30 ? 'bg-state-warn' : 'bg-state-ok';

  const expiry = getPackageExpiryDate(pkg);
  const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysToExpiry !== null && daysToExpiry <= 7;

  return (
    <div className={`rounded-card border px-3.5 py-3 ${isEmpty ? 'border-line-subtle bg-paper opacity-60' : 'border-line bg-paper-raised'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-900 truncate">{pkg.type}</p>
        {consuming > 0 ? (
          <span className="flex-shrink-0 text-caption uppercase bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-md tabular-nums">−{consuming} min</span>
        ) : isEmpty ? (
          <span className="flex-shrink-0 text-caption uppercase bg-ink-200 text-ink-500 px-2 py-0.5 rounded-md">Esgotado</span>
        ) : null}
      </div>

      {/* já usado (trilho cinza) · sai agora (brand) · sobra (semáforo) */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-ink-200 overflow-hidden flex flex-row-reverse">
        <div className={`h-full ${leftTone}`} style={{ width: `${leftAfterPct}%` }} />
        <div className="h-full bg-brand-500" style={{ width: `${pct(consuming)}%` }} />
      </div>

      <p className="mt-1.5 text-xs text-ink-500 tabular-nums">
        Restam <span className="font-semibold text-ink-700">{remainingMin}</span> de {totalMin} min
        {consuming > 0 && <span>{' · '}fica com {leftAfterMin} min</span>}
        {expiry && (
          <span className={expiringSoon ? 'text-state-warn font-semibold' : undefined}>
            {' · '}
            {expiringSoon
              ? daysToExpiry <= 0 ? 'vence hoje' : `vence em ${daysToExpiry} ${daysToExpiry === 1 ? 'dia' : 'dias'}`
              : `vence ${expiry.toLocaleDateString('pt-BR')}`}
          </span>
        )}
      </p>
    </div>
  );
};

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
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    if (isOpen && visit) {
      loadData();
      calculateDuration();
    }
  }, [isOpen, visit]);

  // Mantém o duration vivo enquanto o modal está aberto, para que o preview
  // de valor reflita o que será cobrado no momento do clique em "Confirmar".
  // Sem isso, se o modal fica aberto > 1 min, o preview mostra valor antigo
  // e o cliente vê R$ X mas é cobrado R$ X + alguns centavos.
  useEffect(() => {
    if (!isOpen || !visit) return;
    const interval = setInterval(() => {
      calculateDuration();
      setSiblingVisits(prev => prev.map(s => ({
        ...s,
        duration: recalcDurationFromCheckIn(s.visit.checkIn),
      })));
    }, 15000);
    return () => clearInterval(interval);
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
      toast.error('Não foi possível carregar os dados desta visita. Feche e abra o check-out novamente.');
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

  // Preview de valor — DELEGA para billing.ts (mesma fonte do checkout real)
  // para garantir que preview e cobrança nunca divirjam.
  const calculateValue = () => {
    const includedSiblings = siblingVisits.filter(s => s.included && !s.visit.kidsPlanId);
    const siblingsBillableMin = includedSiblings.reduce(
      (sum, s) => sum + Math.max(s.duration, minimumTime), 0
    );

    if (isKidsPlan) {
      const kc = getKidsPlanCoverage();
      const principalValue = calculatePrincipalValue({
        isKidsPlan: true,
        usePackages: false,
        durationMin: duration,
        minimumTime,
        hourlyRate,
        kidsCoverage: kc,
      });
      setTotalValue(principalValue);
      if (kc.isFullyCovered) {
        setPaymentMethod('package');
      } else if (paymentMethod === 'package') {
        setPaymentMethod('pix');
      }
    } else if (usePackages || selectedAdminPackage) {
      const coverage = getMultiPackageCoverage(siblingsBillableMin);
      const principalValue = calculatePrincipalValue({
        isKidsPlan: false,
        usePackages: true,
        durationMin: duration,
        minimumTime,
        hourlyRate,
        employeeDiscount,
        multiCoverage: coverage,
      });
      setTotalValue(principalValue);
      if (coverage.isFullyCovered) {
        setPaymentMethod('package');
      } else if (principalValue > 0 && paymentMethod === 'package') {
        setPaymentMethod('pix');
      }
    } else {
      // Avulso
      const principalValue = calculatePrincipalValue({
        isKidsPlan: false,
        usePackages: false,
        durationMin: duration,
        minimumTime,
        hourlyRate,
        employeeDiscount,
      });
      setTotalValue(principalValue);
      // Sem pacote não existe quitação "package": sem isto o seletor de
      // PIX/crédito/débito some e o check-out trava pedindo uma forma de
      // pagamento que não há como escolher.
      if (paymentMethod === 'package') setPaymentMethod('pix');
    }
  };

  // Minutos faturáveis dos irmãos incluídos (exceto Kids Plan) — usado para a
  // pré-visualização da cobertura do pacote. Garante que o UI mostre o desconto
  // real (principal + irmãos), idêntico ao que será debitado no checkout.
  const previewSiblingsBillableMin = siblingVisits
    .filter(s => s.included && !s.visit.kidsPlanId)
    .reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);

  // Valor de cada irmão é DERIVADO em render, nunca guardado em state: manter
  // isso no state fazia o efeito que recalcula o total realimentar
  // `siblingVisits` a cada passada e o modal entrava em loop de render.
  const includedSiblings = siblingVisits.filter(s => s.included);

  const includedSiblingCalcs = calculateIncludedSiblingValues({
    principalUsesPackage: !isKidsPlan && (usePackages || !!selectedAdminPackage),
    includedSiblings: includedSiblings.map(s => ({
      durationMin: s.duration,
      isKidsPlan: !!s.visit.kidsPlanId,
    })),
    multiCoverage: !isKidsPlan && (usePackages || selectedAdminPackage)
      ? getMultiPackageCoverage(previewSiblingsBillableMin)
      : undefined,
    minimumTime,
    hourlyRate,
    employeeDiscount,
  });

  const siblingValueByVisitId = new Map(
    includedSiblings.map((s, i) => [s.visit.id, includedSiblingCalcs[i]?.sibValue ?? 0]),
  );
  const siblingValue = (s: SiblingVisit): number => siblingValueByVisitId.get(s.visit.id) ?? 0;

  const includedSiblingsTotal = includedSiblingCalcs.reduce((sum, c) => sum + c.sibValue, 0);

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
      toast.error('Escolha um pacote ou selecione PIX, crédito ou débito.');
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;

    // Débitos de pacote já aplicados nesta tentativa — usados para reverter se
    // uma etapa posterior do check-out falhar.
    const appliedDeductions: PackageDeductionUndo[] = [];
    // Vira true quando a visita principal já foi fechada: a partir daí o erro
    // não pode dizer que "nada foi cobrado".
    let mainVisitCommitted = false;

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
        mainVisitCommitted = true;
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

        // 2. Descontar horas de cada pacote usado (inclui principal + irmãos).
        // Se um débito falhar no meio, desfaz os anteriores — senão o cliente
        // perde horas a cada tentativa de check-out que der erro.
        for (const { pkg, coveredMin } of coverage.breakdown) {
          const hoursToDeduct = coveredMin / 60;
          try {
            const undo = await packagesServiceOffline.usePackage(pkg.id, hoursToDeduct);
            appliedDeductions.push(undo);
          } catch (error) {
            await packagesServiceOffline.undoPackageDeductions(appliedDeductions);
            appliedDeductions.length = 0;
            throw new Error(`não foi possível debitar o pacote ${pkg.type} — ${(error as Error).message}`);
          }
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

        // Ponto de commit: a visita principal já consumiu essas horas. Falhas
        // daqui pra frente (irmãos, impressão) não podem devolver o saldo.
        appliedDeductions.length = 0;
        mainVisitCommitted = true;
      }

      // 4. Processar checkout dos irmãos incluídos com durações ATUALIZADAS (via billing.ts)
      const includedSiblings = freshSiblings.filter(s => s.included);

      // Mesma função usada na pré-visualização — preview e cobrança não podem
      // divergir. Aqui as durações são as recalculadas no momento do clique.
      const principalUsesPackage = !isKidsPlan && (usePackages || !!selectedAdminPackage);
      const sibInputs = includedSiblings.map(s => ({
        durationMin: s.duration,
        isKidsPlan: !!s.visit.kidsPlanId,
      }));
      const sibCalcs = calculateIncludedSiblingValues({
        principalUsesPackage,
        includedSiblings: sibInputs,
        multiCoverage: principalUsesPackage
          ? getMultiPackageCoverage(
              includedSiblings
                .filter(s => !s.visit.kidsPlanId)
                .reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0),
              actualDuration,
            )
          : undefined,
        minimumTime,
        hourlyRate,
        employeeDiscount,
      });

      const pkgFirstId: string | undefined = (() => {
        if (isKidsPlan || !(usePackages || selectedAdminPackage) || includedSiblings.length === 0) return undefined;
        const includedSibsNonKids = includedSiblings.filter(s => !s.visit.kidsPlanId);
        const sibsBill = includedSibsNonKids.reduce((sum, s) => sum + Math.max(s.duration, minimumTime), 0);
        return getMultiPackageCoverage(sibsBill, actualDuration).breakdown[0]?.pkg.id;
      })();

      // Cada irmão é independente — paraleliza as operações entre irmãos para
      // cortar o tempo total. Dentro de um mesmo irmão, createPayment e checkOut
      // continuam sequenciais (checkOut precisa do paymentId).
      await Promise.all(includedSiblings.map(async (sibling, i) => {
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
      }));

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

        // Calcular info do pacote após uso (horas restantes e vencimento)
        let pkgInfo: { remainingHours: number; expiresAt: string }[] | undefined;
        if (usePackages || selectedAdminPackage) {
          const usedPkgs = selectedPackages();
          pkgInfo = usedPkgs.filter(p => p.active).map(p => {
            const remaining = Math.max(0, p.hours - p.usedHours);
            let expStr = 'N/A';
            if (p.expiryDays && p.expiryDays > 0 && p.createdAt) {
              const created = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
              const exp = new Date(created);
              exp.setDate(exp.getDate() + p.expiryDays);
              expStr = exp.toLocaleDateString('pt-BR');
            } else if (p.expiresAt) {
              const exp = p.expiresAt instanceof Date ? p.expiresAt : new Date(p.expiresAt);
              expStr = exp.toLocaleDateString('pt-BR');
            }
            return { remainingHours: remaining, expiresAt: expStr };
          });
        }

        printSuccess = await handleFiscalNote(fiscalDuration, fiscalValue, printSiblings, pkgInfo);
      } else {
        console.log('[CHECKOUT] Impressão fiscal DESABILITADA - condições não atendidas');
      }

      if (printSuccess) {
        toast.success('Check-out concluído');
      } else {
        toast.success('Check-out concluído. O comprovante não foi impresso.');
      }
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error during checkout:', error);
      // Reverte horas já debitadas se a falha veio depois dos débitos
      // (pagamento, checkout da visita, irmãos...).
      if (appliedDeductions.length > 0) {
        await packagesServiceOffline.undoPackageDeductions(appliedDeductions);
      }
      const detail = error instanceof Error && error.message ? error.message : String(error);
      toast.error(
        // fica até o operador fechar: a mensagem diz o que fazer a seguir
        mainVisitCommitted
          // A visita principal já foi fechada — só irmãos/comprovante falharam.
          ? `A visita de ${child?.name || 'a criança'} foi fechada, mas houve um erro depois: ${detail}. Confira o Histórico de Visitas antes de repetir.`
          : `Check-out não concluído: ${detail}. Nada foi cobrado — corrija e tente de novo.`,
        { autoClose: 10000 },
      );
    } finally {
      processingRef.current = false;
      setLoading(false);
    }
  };

  const handleFiscalNote = async (
    durationOverride?: number,
    totalValueOverride?: number,
    siblings?: { childName: string; duration: number; value: number }[],
    packageInfo?: { remainingHours: number; expiresAt: string }[],
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
        ...(packageInfo && packageInfo.length > 0 ? [
          '',
          '--- INFO PACOTE ---',
          ...packageInfo.flatMap(p => [
            `Restante: ${p.remainingHours.toFixed(1)}h`,
            `Vencimento: ${p.expiresAt}`,
          ]),
        ] : []),
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
        toast.success('Comprovante impresso');
        return true;
      } else {
        toast.warning('A impressora não respondeu. Reimprima o comprovante pelo Histórico de Visitas.');
        return false;
      }
    } catch (error) {
      console.error('[CHECKOUT] Error printing receipt:', error);
      toast.error('Não foi possível imprimir o comprovante. Reimprima pelo Histórico de Visitas.');
      return false;
    }
  };

  const handleClose = () => {
    setUsePackages(false);
    setSelectedAdminPackage('');
    setPaymentMethod('pix');
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    setShowAdminPanel(false);
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
      <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-line bg-paper-raised/95 backdrop-blur-sm">
          <h2 className="text-heading text-ink-900">Check-out</h2>
          <button
            onClick={handleClose}
            aria-label="Fechar check-out"
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors focus-visible:outline-none focus-visible:shadow-focus"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Quem está saindo e há quanto tempo — a permanência é o número que o
              operador confere antes de qualquer decisão de cobrança. */}
          <div className="rounded-card border border-line bg-surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-ink-900 truncate">{child?.name || 'Carregando…'}</p>
                <p className="text-xs text-ink-500 truncate mt-0.5">{customer?.name || 'Carregando…'}</p>
              </div>
              {isKidsPlan && (
                <span className="flex-shrink-0 text-caption uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded-md">Plano Kids · 3h grátis/dia</span>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-line flex items-baseline justify-between gap-3">
              <span className="text-caption uppercase text-ink-400">Permanência</span>
              <span className={`text-3xl font-bold tabular-nums tracking-tight ${duration >= LONG_VISIT_ALERT_MINUTES ? 'text-state-warn' : 'text-brand-600'}`}>
                {formatTime(duration)}
              </span>
            </div>

            {duration >= LONG_VISIT_ALERT_MINUTES && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-state-warn/30 bg-state-warn-soft px-3 py-2">
                <svg className="w-4 h-4 text-state-warn flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                <p className="text-xs text-state-warn">
                  Acima de {LONG_VISIT_ALERT_MINUTES / 60}h — confira o horário de saída antes de cobrar.
                </p>
              </div>
            )}

            {!isKidsPlan && !(usePackages || selectedAdminPackage) && duration < minimumTime && (
              <p className="mt-3 text-xs text-ink-500">
                Abaixo do tempo mínimo — serão cobrados <span className="font-semibold text-state-warn">{formatTime(minimumTime)}</span>.
              </p>
            )}
          </div>

          {/* Controles de entrada — somem na revisão para que o passo de
              confirmação seja de fato uma revisão, e não a mesma tela de novo. */}
          {!showConfirmation && (<>
          {/* Visitas de Irmãos */}
          {siblingVisits.length > 0 && (
            <div className="border border-brand-200 rounded-card p-4 bg-brand-50/50">
              <p className="text-xs font-bold text-brand-800 mb-1 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                Irmãos com visita ativa ({siblingVisits.length})
              </p>
              <p className="text-xs text-brand-700/80 mb-2.5">
                Marque apenas os irmãos que você quer fechar junto neste check-out.
              </p>
              <div className="flex gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => setAllSiblingsIncluded(true)}
                  className="px-2.5 py-1 rounded-md border border-brand-200 bg-paper-raised text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors focus-visible:outline-none focus-visible:shadow-focus"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setAllSiblingsIncluded(false)}
                  className="px-2.5 py-1 rounded-md border border-line bg-paper-raised text-xs font-semibold text-ink-600 hover:bg-paper transition-colors focus-visible:outline-none focus-visible:shadow-focus"
                >
                  Limpar seleção
                </button>
              </div>
              <div className="space-y-1.5">
                {siblingVisits.map((sibling) => (
                  <label key={sibling.visit.id} className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border transition-all ${sibling.included ? 'bg-paper-raised border-brand-300' : 'bg-paper-raised/60 border-line hover:border-brand-300'}`}>
                    <input
                      type="checkbox"
                      checked={sibling.included}
                      onChange={() => toggleSibling(sibling.visit.id)}
                      className="w-4 h-4 accent-brand-600 rounded border-line-strong focus-visible:outline-none focus-visible:shadow-focus"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${sibling.included ? 'text-ink-800' : 'text-ink-500'}`}>{sibling.child.name}</p>
                      <p className="text-xs text-ink-500">
                        {formatTime(sibling.duration)}
                        {sibling.included && (siblingValue(sibling) > 0 ? ` · ${formatBRL(siblingValue(sibling))}` : sibling.visit.kidsPlanId ? ' · Plano Kids' : ' · Pacote')}
                        {!sibling.included && ' · não será cobrado'}
                      </p>
                    </div>
                    {sibling.included && (
                      <span className="text-caption uppercase bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md flex-shrink-0">Incluído</span>
                    )}
                  </label>
                ))}
              </div>
              {includedSiblingsTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-brand-200 flex justify-between items-center text-sm">
                  <span className="text-brand-700 font-medium">Subtotal irmãos</span>
                  <span className="font-bold text-brand-700 tabular-nums">{formatBRL(includedSiblingsTotal)}</span>
                </div>
              )}
            </div>
          )}

          {/* Packages - hide if KidsPlan */}
          {!isKidsPlan && packages.length > 0 && (
            <div>
              <p className="text-caption uppercase text-ink-400 mb-2">Forma de cobrança</p>
              {isPayingAvulsoDespitePackage && (
                <div className="mb-3 border border-state-warn/30 bg-state-warn-soft rounded-card p-3 flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-state-warn flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-state-warn">Este cliente tem pacote com saldo</p>
                    <p className="text-xs text-state-warn mt-0.5">
                      {customerPackagesWithBalance.length === 1
                        ? `1 pacote com ${Math.round(customerPackagesWithBalance.reduce((s, p) => s + (p.hours - p.usedHours) * 60, 0))} min`
                        : `${customerPackagesWithBalance.length} pacotes com ${Math.round(customerPackagesWithBalance.reduce((s, p) => s + (p.hours - p.usedHours) * 60, 0))} min no total`}
                      {' '}disponível. Cobrar avulso só se for essa a intenção.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2" role="radiogroup" aria-label="Forma de cobrança">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!usePackages && !selectedAdminPackage}
                  onClick={() => { setUsePackages(false); setSelectedAdminPackage(''); }}
                  className={`w-full flex items-start gap-3 text-left px-3.5 py-3 rounded-card border transition-all focus-visible:outline-none focus-visible:shadow-focus ${!usePackages && !selectedAdminPackage ? 'bg-brand-50 border-brand-400' : 'bg-paper-raised border-line hover:border-brand-300'}`}
                >
                  <RadioDot checked={!usePackages && !selectedAdminPackage} />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Pagamento avulso</p>
                    <p className="text-xs text-ink-500 mt-0.5">Cobrar esta visita por hora</p>
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={usePackages}
                  onClick={() => { setUsePackages(true); setSelectedAdminPackage(''); }}
                  className={`w-full flex items-start gap-3 text-left px-3.5 py-3 rounded-card border transition-all focus-visible:outline-none focus-visible:shadow-focus ${usePackages ? 'bg-state-ok-soft border-state-ok' : 'bg-paper-raised border-line hover:border-state-ok/30'}`}
                >
                  <RadioDot checked={usePackages} tone="emerald" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Usar pacotes do cliente</p>
                    <p className="text-xs text-ink-500 mt-0.5">Consome do menor saldo para o maior</p>
                  </div>
                </button>

                {usePackages && (
                  <div className="ml-3 pl-4 border-l-2 border-state-ok/30 space-y-2">
                    {packages
                      .slice()
                      .sort((a, b) => (a.hours - a.usedHours) - (b.hours - b.usedHours))
                      .map((pkg) => {
                        const coverage = getMultiPackageCoverage(previewSiblingsBillableMin);
                        const pkgCoverage = coverage.breakdown.find(b => b.pkg.id === pkg.id);
                        return (
                          <PackageBalanceRow
                            key={pkg.id}
                            pkg={pkg}
                            consumingMin={pkgCoverage?.coveredMin ?? 0}
                          />
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Saída de exceção: cobrar do pacote de outro cliente. Fica recolhida
              para não competir com o fluxo normal, e só abre sob senha. */}
          {!isKidsPlan && allPackages.length > 0 && !showAdminPanel && !selectedAdminPackage && (
            <button
              type="button"
              onClick={() => setShowAdminPanel(true)}
              className="text-xs font-semibold text-ink-500 hover:text-brand-600 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:shadow-focus rounded"
            >
              Cobrar do pacote de outro cliente
            </button>
          )}

          {!isKidsPlan && allPackages.length > 0 && (showAdminPanel || selectedAdminPackage) && (
            <div className="border border-state-warn/30 rounded-card p-3.5 bg-state-warn-soft">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-caption uppercase text-state-warn">Pacote de outro cliente</p>
                <button
                  type="button"
                  onClick={() => { setShowAdminPanel(false); setSelectedAdminPackage(''); }}
                  className="text-xs text-state-warn hover:text-state-warn transition-colors focus-visible:outline-none focus-visible:shadow-focus rounded"
                >
                  Fechar
                </button>
              </div>
              {!isAdminAuthenticated ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminPassword === ADMIN_PASSWORD) { setIsAdminAuthenticated(true); toast.success('Acesso de administrador liberado'); }
                    else { toast.error('Senha de administrador incorreta'); setAdminPassword(''); }
                  }}
                >
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Senha de administrador" aria-label="Senha de administrador" className="flex-1 px-3 py-2 border border-state-warn/30 bg-paper-raised rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-state-warn" />
                  <button type="submit" className="bg-state-warn text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-state-warn transition-colors focus-visible:outline-none focus-visible:shadow-focus">Liberar</button>
                </form>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-state-ok font-semibold">Administrador liberado</span>
                    <button type="button" onClick={() => { setIsAdminAuthenticated(false); setAdminPassword(''); setSelectedAdminPackage(''); }} className="text-xs text-ink-500 hover:text-ink-700 transition-colors focus-visible:outline-none focus-visible:shadow-focus rounded">Bloquear</button>
                  </div>
                  {allPackages.map(pkg => {
                    const remainingHours = pkg.hours - pkg.usedHours;
                    const remainingMin = Math.round(remainingHours * 60);
                    const hasTime = remainingHours > 0;
                    return (
                      <button key={pkg.id} type="button" onClick={() => { if (hasTime) { setSelectedAdminPackage(pkg.id); setUsePackages(false); } }} disabled={!hasTime}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all focus-visible:outline-none focus-visible:shadow-focus ${selectedAdminPackage === pkg.id ? 'bg-state-warn-soft border border-state-warn/30' : hasTime ? 'bg-paper-raised/60 hover:bg-paper-raised border border-transparent' : 'opacity-40 cursor-not-allowed border border-transparent'}`}>
                        <p className="font-semibold text-ink-900">{pkg.type} <span className="text-xs font-normal text-state-warn">· {customers.find(c => c.id === pkg.customerId)?.name || 'sem responsável'}</span></p>
                        <p className="text-xs text-ink-500 tabular-nums">{remainingMin} de {Math.round(pkg.hours * 60)} min restantes</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Employee Discount */}
          {!isKidsPlan && !usePackages && !selectedAdminPackage && (
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-line hover:bg-paper transition-all">
              <div className="relative">
                <input type="checkbox" checked={employeeDiscount} onChange={(e) => setEmployeeDiscount(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-brand-500 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-paper-raised rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
              </div>
              <div>
                <span className="text-sm font-semibold text-ink-700">Desconto colaborador</span>
                <span className="text-xs text-ink-400 ml-1.5">(50%)</span>
              </div>
            </label>
          )}

          </>)}

          {/* Total */}
          {(() => {
            if (isKidsPlan) {
              const kidsCov = getKidsPlanCoverage();
              return (
                <div className={`rounded-lg p-4 border ${kidsCov.isPartial ? 'bg-state-warn-soft border-state-warn/30' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-600">Plano Kids (grátis)</span>
                      <span className="font-semibold text-blue-600">{kidsCov.coveredMin}min</span>
                    </div>
                    {kidsCov.isPartial && (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-ink-600">Excedente</span>
                          <span className="font-semibold text-state-warn">{kidsCov.excessMin}min</span>
                        </div>
                        {kidsCov.billableExcessMin > kidsCov.excessMin && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-ink-600">Tempo mínimo cobrado</span>
                            <span className="font-semibold text-state-warn">{kidsCov.billableExcessMin}min</span>
                          </div>
                        )}
                        <div className="border-t border-state-warn/30 pt-2 flex justify-between items-baseline gap-3">
                          <span className="text-sm font-semibold text-ink-700">A pagar pelo excedente</span>
                          <span className="text-xl font-bold text-state-warn tabular-nums">{formatBRL(totalValue)}</span>
                        </div>
                      </>
                    )}
                    {kidsCov.isFullyCovered && (
                      <div className="border-t border-blue-200 pt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-700">Total</p>
                          <p className="text-xs text-blue-700 mt-0.5">Coberto pelo Plano Kids</p>
                        </div>
                        <span className="text-2xl font-bold text-blue-600 tabular-nums">{formatBRL(0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const coverage = (usePackages || selectedAdminPackage) ? getMultiPackageCoverage(previewSiblingsBillableMin) : null;
            return (
              <div className={`rounded-lg p-4 border ${coverage?.isPartial ? 'bg-state-warn-soft border-state-warn/30' : 'bg-state-ok-soft border-state-ok/30'}`}>
                {coverage && coverage.hasPackages && (coverage.isPartial || coverage.isFullyCovered) ? (
                  <div className="space-y-2">
                    {/* O detalhe por pacote já aparece nos medidores acima —
                        aqui fica só o consolidado, para não repetir a mesma
                        informação duas vezes na mesma tela. */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-600">
                        Coberto por {coverage.breakdown.length} {coverage.breakdown.length === 1 ? 'pacote' : 'pacotes'}
                      </span>
                      <span className="font-semibold text-state-ok tabular-nums">−{coverage.totalCoveredMin} min</span>
                    </div>
                    {coverage.isPartial && (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-ink-600">Excedente</span>
                          <span className="font-semibold text-state-warn">{coverage.excessMin}min</span>
                        </div>
                        {coverage.billableExcessMin > coverage.excessMin && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-ink-600">Tempo mínimo cobrado</span>
                            <span className="font-semibold text-state-warn">{coverage.billableExcessMin}min</span>
                          </div>
                        )}
                        <div className="border-t border-state-warn/30 pt-2 flex justify-between items-baseline gap-3">
                          <span className="text-sm font-semibold text-ink-700">A pagar pelo excedente</span>
                          <span className="text-xl font-bold text-state-warn tabular-nums">{formatBRL(totalValue)}</span>
                        </div>
                      </>
                    )}
                    {coverage.isFullyCovered && (
                      <div className="border-t border-state-ok/30 pt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-700">Total</p>
                          <p className="text-xs text-state-ok mt-0.5">Coberto pelo pacote</p>
                        </div>
                        <span className="text-2xl font-bold text-state-ok tabular-nums">{formatBRL(0)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {employeeDiscount && (
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-ink-500">Desconto colaborador (50%)</span>
                        <span className="text-ink-400 line-through tabular-nums">{formatBRL(totalValue * 2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-sm font-semibold text-ink-700">Total</span>
                      <span className="text-2xl font-bold text-state-ok tabular-nums">{formatBRL(totalValue)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Total Combinado (principal + irmãos) */}
          {siblingVisits.filter(s => s.included).length > 0 && (
            <div className="rounded-card p-4 border border-brand-300 bg-brand-50">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-ink-600">{child?.name || 'Principal'}</span>
                  <span className="font-semibold text-ink-700 tabular-nums">{formatBRL(totalValue)}</span>
                </div>
                {siblingVisits.filter(s => s.included).map(s => (
                  <div key={s.visit.id} className="flex justify-between items-center">
                    <span className="text-ink-600">{s.child.name}</span>
                    <span className="font-semibold text-ink-700 tabular-nums">{siblingValue(s) > 0 ? formatBRL(siblingValue(s)) : s.visit.kidsPlanId ? 'Plano Kids' : 'Pacote'}</span>
                  </div>
                ))}
                <div className="border-t border-brand-300 pt-2 flex justify-between items-center">
                  <span className="font-bold text-brand-800">Total Geral</span>
                  <span className="text-2xl font-bold text-brand-700 tabular-nums">{formatBRL(combinedTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          {!showConfirmation && totalValue > 0 && paymentMethod !== 'package' && (
            <div>
              <p className="text-caption uppercase text-ink-400 mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {(['pix', 'credit', 'debit'] as const).map(method => (
                  <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-card border text-center transition-all focus-visible:outline-none focus-visible:shadow-focus ${paymentMethod === method ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'}`}>
                    <div className="flex justify-center mb-1">{method === 'pix' ? <svg className="w-6 h-6 text-state-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}</div>
                    <div className="text-xs font-medium text-ink-700">{method === 'pix' ? 'PIX' : method === 'credit' ? 'Crédito' : 'Débito'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Print */}
          {!showConfirmation && fiscalConfig?.enableFiscalPrint && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={printFiscalNote} onChange={(e) => setPrintFiscalNote(e.target.checked)} className="w-4 h-4 accent-brand-600 rounded border-line-strong focus-visible:outline-none focus-visible:shadow-focus" />
              <span className="text-sm text-ink-600">Imprimir comprovante</span>
            </label>
          )}

          {/* Passo 1 leva à revisão; quem confirma de fato é o botão do passo 2. */}
          {!showConfirmation ? (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors focus-visible:outline-none focus-visible:shadow-focus">Cancelar</button>
              <button type="button" onClick={() => {
                if (!isKidsPlan && !(usePackages || selectedAdminPackage) && paymentMethod === 'package') {
                  toast.error('Escolha um pacote ou selecione PIX, crédito ou débito.');
                  return;
                }
                setShowConfirmation(true);
              }} disabled={loading || !child} className="flex-1 py-2.5 rounded-lg bg-brand-gradient shadow-brand-sm hover:brightness-110 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:shadow-focus">
                {!child ? 'Carregando…' : 'Revisar check-out'}
              </button>
            </div>
          ) : (
            <div className="border border-state-warn/30 bg-state-warn-soft rounded-card p-4 space-y-3">
              <p className="text-caption uppercase text-state-warn text-center">Confira antes de confirmar</p>
              {isPayingAvulsoDespitePackage && (
                <div className="border border-state-warn/30 bg-orange-100 rounded-card p-3 flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-state-warn flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-orange-900">Você está cobrando avulso com pacote disponível</p>
                    <p className="text-xs text-state-warn mt-0.5">
                      O cliente tem {Math.round(customerPackagesWithBalance.reduce((s, p) => s + (p.hours - p.usedHours) * 60, 0))} min disponíveis. Volte e escolha “Usar pacotes do cliente” se for engano.
                    </p>
                  </div>
                </div>
              )}
              <div className="text-sm text-ink-700 space-y-1.5">
                {/* Só o que ainda não está visível no restante da tela: como
                    será quitado, o comprovante e os irmãos incluídos. */}
                {(() => {
                  const formaLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'Crédito' : 'Débito';
                  if (isKidsPlan) {
                    const kidsCov = getKidsPlanCoverage();
                    return kidsCov.isFullyCovered
                      ? <p><span className="text-ink-500">Quitação:</span> <span className="font-bold text-blue-700">Plano Kids · {kidsCov.coveredMin}min grátis</span></p>
                      : <p><span className="text-ink-500">Quitação:</span> <span className="font-bold text-state-warn">{formaLabel} · {formatBRL(totalValue)}</span> <span className="text-ink-500">(excedente de {kidsCov.excessMin}min)</span></p>;
                  }
                  const coverage = (usePackages || selectedAdminPackage) ? getMultiPackageCoverage(previewSiblingsBillableMin) : null;
                  if (coverage?.isFullyCovered) {
                    return <p><span className="text-ink-500">Quitação:</span> <span className="font-bold text-brand-700">Pacote do cliente · nada a cobrar</span></p>;
                  }
                  if (coverage?.isPartial) {
                    return <p><span className="text-ink-500">Quitação:</span> <span className="font-bold text-state-warn">{formaLabel} · {formatBRL(totalValue)}</span> <span className="text-ink-500">(excedente de {coverage.excessMin}min)</span></p>;
                  }
                  return <p><span className="text-ink-500">Quitação:</span> <span className="font-bold text-state-ok">{formaLabel} · {formatBRL(totalValue)}</span></p>;
                })()}

                {fiscalConfig?.enableFiscalPrint && (
                  <p><span className="text-ink-500">Comprovante:</span> {printFiscalNote ? 'será impresso' : 'não será impresso'}</p>
                )}

                {siblingVisits.filter(s => s.included).length > 0 && (
                  <div className="pt-1.5 mt-1.5 border-t border-state-warn/30 space-y-1">
                    <p className="text-ink-500">Irmãos incluídos:</p>
                    {siblingVisits.filter(s => s.included).map(s => (
                      <p key={s.visit.id} className="ml-2">
                        • {s.child.name} — {formatTime(s.duration)} ·{' '}
                        <span className="font-semibold text-ink-800">
                          {siblingValue(s) > 0 ? formatBRL(siblingValue(s)) : s.visit.kidsPlanId ? 'Plano Kids' : 'Pacote'}
                        </span>
                      </p>
                    ))}
                    <p className="pt-1.5 border-t border-state-warn/30">
                      <span className="font-bold text-brand-800">Total geral:</span>{' '}
                      <span className="text-lg font-bold text-brand-700 tabular-nums">{formatBRL(combinedTotal)}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowConfirmation(false)} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-focus">Voltar</button>
                <button type="button" onClick={handleCheckOut} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-state-ok hover:bg-[#166b4c] text-white text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-focus">
                  {loading ? 'Processando…' : 'Confirmar check-out'}
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
