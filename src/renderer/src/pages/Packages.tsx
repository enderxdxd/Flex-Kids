import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, Customer, Child } from '../../../shared/types';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';
import { useUnit } from '../contexts/UnitContext';
import { getChildAge } from '../../../shared/utils/age';
import { getPackageExpiryDate } from '../../../shared/utils/packageExpiry';
import {
  Card, Button, IconButton, PageHeader, EmptyState, Skeleton, Badge, Input, cn,
} from '../components/ui';
import { formatBRL } from '../../../shared/utils/currency';
import { RefreshIcon, PackageIcon } from '../components/icons/Icons';

interface PackageFormData {
  customerId: string;
  childId?: string;
  type: string;
  hours: number;
  price: number;
  expiryDays?: number;
  unitId: string;
}

interface PlanConfig {
  name: string;
  hours: number;
  price: number;
  expiryDays: number;
}

const Packages: React.FC = () => {
  const { currentUnit } = useUnit();
  const [packages, setPackages] = useState<Package[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [activeTab, setActiveTab] = useState<'packages' | 'plans'>('packages');
  const [searchTerm, setSearchTerm] = useState('');

  // Planos configuráveis
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [newPlan, setNewPlan] = useState<PlanConfig>({ name: '', hours: 10, price: 300, expiryDays: 30 });
  const [editingPlanIdx, setEditingPlanIdx] = useState<number | null>(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [pendingEditPkg, setPendingEditPkg] = useState<Package | null>(null);
  const [pendingAction, setPendingAction] = useState<'plans' | 'editPkg' | 'adjustHours' | null>(null);
  const ADMIN_PASSWORD = 'pactoflex123';

  // Estado para modal de impressão de resumo do pacote
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPkg, setPrintPkg] = useState<Package | null>(null);
  const [printing, setPrinting] = useState(false);

  // Estado para modal de ajuste de horas (admin only)
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPkg, setAdjustPkg] = useState<Package | null>(null);
  const [adjustHours, setAdjustHours] = useState(0);
  const [adjustUsedHours, setAdjustUsedHours] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Estado para modal de renovação
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewPkg, setRenewPkg] = useState<Package | null>(null);
  const [renewHours, setRenewHours] = useState(10);
  const [renewPrice, setRenewPrice] = useState(300);
  const [renewExpiryDays, setRenewExpiryDays] = useState(30);
  const [renewPlanName, setRenewPlanName] = useState('');

  // Estado para modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPackageData, setPendingPackageData] = useState<PackageFormData | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [renewalPackageId, setRenewalPackageId] = useState<string | null>(null);
  const [renewalRemainingHours, setRenewalRemainingHours] = useState(0);
  const [editExpiresAt, setEditExpiresAt] = useState<string>('');
  const [initialEditExpiresAt, setInitialEditExpiresAt] = useState<string>('');
  const [initialEditExpiryDays, setInitialEditExpiryDays] = useState<number | undefined>(undefined);

  const [formData, setFormData] = useState<PackageFormData>({
    customerId: '',
    type: '',
    hours: 10,
    price: 300,
    expiryDays: 30,
    unitId: currentUnit,
  });

  useEffect(() => {
    loadData();

    // Listen for background Firebase fetch completing with full package list
    const handlePackagesUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.packages) {
        setPackages(detail.packages);
      }
    };
    window.addEventListener('packages-updated', handlePackagesUpdated);
    return () => window.removeEventListener('packages-updated', handlePackagesUpdated);
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPackages, allCustomers, allChildren, savedPlans] = await Promise.all([
        packagesServiceOffline.getAllPackages(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        settingsServiceOffline.getPackagePlans(currentUnit),
      ]);

      setPackages(allPackages);
      setCustomers(allCustomers);
      setChildren(allChildren);
      setPlans(savedPlans);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // === Plan Management ===
  const handleSavePlan = async () => {
    if (!newPlan.name || newPlan.hours <= 0 || newPlan.price <= 0) {
      toast.error('Preencha todos os campos do plano');
      return;
    }
    let updated: PlanConfig[];
    if (editingPlanIdx !== null) {
      updated = [...plans];
      updated[editingPlanIdx] = { ...newPlan };
      setEditingPlanIdx(null);
    } else {
      if (plans.some(p => p.name === newPlan.name)) {
        toast.error('Já existe um plano com esse nome');
        return;
      }
      updated = [...plans, { ...newPlan }];
    }
    await settingsServiceOffline.savePackagePlans(updated, currentUnit);
    setPlans(updated);
    setNewPlan({ name: '', hours: 10, price: 300, expiryDays: 30 });
    toast.success(editingPlanIdx !== null ? 'Plano atualizado!' : 'Plano adicionado!');
  };

  const handleDeletePlan = async (idx: number) => {
    const updated = plans.filter((_, i) => i !== idx);
    await settingsServiceOffline.savePackagePlans(updated, currentUnit);
    setPlans(updated);
    toast.success('Plano removido');
  };

  const handleEditPlan = (idx: number) => {
    setNewPlan({ ...plans[idx] });
    setEditingPlanIdx(idx);
  };

  // === Package CRUD ===
  const openModal = (pkg?: Package) => {
    if (pkg) {
      if (!adminAuth) {
        setPendingEditPkg(pkg);
        return;
      }
      setEditingPackage(pkg);
      setFormData({
        customerId: pkg.customerId,
        childId: pkg.childId,
        type: pkg.type,
        hours: pkg.hours,
        price: pkg.price,
        expiryDays: pkg.expiryDays || 30,
        unitId: pkg.unitId,
      });
      // Calcular data de expiração para o input date
      const expDate = getExpirationDate(pkg);
      const initialDateStr = expDate ? format(expDate, 'yyyy-MM-dd') : '';
      setEditExpiresAt(initialDateStr);
      setInitialEditExpiresAt(initialDateStr);
      setInitialEditExpiryDays(pkg.expiryDays);
    } else {
      setEditingPackage(null);
      setFormData({
        customerId: '',
        type: plans[0]?.name || '',
        hours: plans[0]?.hours || 10,
        price: plans[0]?.price || 300,
        expiryDays: plans[0]?.expiryDays || 30,
        unitId: currentUnit,
      });
      setEditExpiresAt('');
      setInitialEditExpiresAt('');
      setInitialEditExpiryDays(undefined);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.customerId) {
      toast.error('Selecione um responsável');
      return;
    }
    setSaving(true);
    try {
      if (editingPackage) {
        const updatePayload: any = {
          type: formData.type,
          hours: formData.hours,
          price: formData.price,
          unitId: currentUnit,
        };

        const created = editingPackage.createdAt instanceof Date
          ? editingPackage.createdAt
          : new Date(editingPackage.createdAt);
        const createdValid = !Number.isNaN(created.getTime());

        const dateChanged = editExpiresAt && editExpiresAt !== initialEditExpiresAt;
        const daysChanged = formData.expiryDays !== undefined
          && formData.expiryDays !== initialEditExpiryDays;

        // Manter expiryDays e expiresAt em sincronia (ambos derivam da mesma intenção)
        if (dateChanged && createdValid) {
          // Admin alterou a data: derivar expiryDays da diferença
          const newExp = new Date(editExpiresAt + 'T23:59:59');
          updatePayload.expiresAt = newExp;
          const diffDays = Math.ceil((newExp.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) updatePayload.expiryDays = diffDays;
        } else if (daysChanged && createdValid && formData.expiryDays) {
          // Admin alterou só o dropdown: derivar expiresAt
          updatePayload.expiryDays = formData.expiryDays;
          const newExp = new Date(created);
          newExp.setDate(newExp.getDate() + formData.expiryDays);
          newExp.setHours(23, 59, 59, 999);
          updatePayload.expiresAt = newExp;
        } else if (formData.expiryDays !== undefined) {
          // Nada mudou em expiração, preservar valores existentes
          updatePayload.expiryDays = formData.expiryDays;
        }

        await packagesServiceOffline.updatePackage(editingPackage.id, updatePayload);
        toast.success('Pacote atualizado!');
        setShowModal(false);
        loadData();
      } else {
        const customer = customers.find(c => c.id === formData.customerId);
        const child = formData.childId ? children.find(c => c.id === formData.childId) : undefined;
        if (customer) {
          setPendingPackageData({ ...formData, unitId: currentUnit });
          setSelectedChild(child || null);
          setSelectedCustomer(customer);
          setShowPaymentModal(true);
        }
      }
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Erro ao salvar pacote');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPendingPackageData(null);
    setSelectedChild(null);
    setSelectedCustomer(null);
    setRenewalPackageId(null);
    setRenewalRemainingHours(0);
    setShowModal(false);
    loadData();
  };

  // === Ajustar Horas (Admin) ===
  const openAdjustHoursModal = (pkg: Package) => {
    if (!adminAuth) {
      setPendingEditPkg(pkg);
      setPendingAction('adjustHours');
      return;
    }
    setAdjustPkg(pkg);
    setAdjustHours(pkg.hours);
    setAdjustUsedHours(pkg.usedHours);
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const handleAdjustHours = async () => {
    if (!adjustPkg) return;
    if (adjustHours <= 0) {
      toast.error('Horas totais devem ser maior que 0');
      return;
    }
    if (adjustUsedHours < 0) {
      toast.error('Horas usadas n\u00e3o podem ser negativas');
      return;
    }
    if (adjustUsedHours > adjustHours) {
      toast.error('Horas usadas n\u00e3o podem ser maiores que as horas totais');
      return;
    }
    setAdjustSaving(true);
    try {
      const isActive = adjustUsedHours < adjustHours;
      await packagesServiceOffline.updatePackage(adjustPkg.id, {
        hours: adjustHours,
        usedHours: adjustUsedHours,
        active: isActive,
      });
      console.log(`[Admin] Ajuste de horas: ${adjustPkg.id} | ${adjustPkg.hours}h→${adjustHours}h | usado ${adjustPkg.usedHours}h→${adjustUsedHours}h | motivo: ${adjustReason}`);
      toast.success(`Horas ajustadas com sucesso! ${adjustHours}h total, ${adjustUsedHours}h usadas`);
      setShowAdjustModal(false);
      setAdjustPkg(null);
      loadData();
    } catch (error) {
      console.error('Error adjusting hours:', error);
      toast.error('Erro ao ajustar horas');
    } finally {
      setAdjustSaving(false);
    }
  };

  // === Renovação de Pacote ===
  const openRenewModal = (pkg: Package) => {
    setRenewPkg(pkg);
    const defaultPlan = plans.find(p => p.name === pkg.type) || plans[0];
    if (defaultPlan) {
      setRenewHours(defaultPlan.hours);
      setRenewPrice(defaultPlan.price);
      setRenewExpiryDays(defaultPlan.expiryDays);
      setRenewPlanName(defaultPlan.name);
    } else {
      setRenewHours(pkg.hours);
      setRenewPrice(pkg.price);
      setRenewExpiryDays(pkg.expiryDays || 30);
      setRenewPlanName(pkg.type);
    }
    setShowRenewModal(true);
  };

  const handleConfirmRenewal = () => {
    if (!renewPkg) return;
    const customer = customers.find(c => c.id === renewPkg.customerId);
    const child = renewPkg.childId ? children.find(c => c.id === renewPkg.childId) : undefined;
    if (!customer) {
      toast.error('Responsável não encontrado');
      return;
    }
    const remaining = getRemainingHours(renewPkg);
    setRenewalPackageId(renewPkg.id);
    setRenewalRemainingHours(remaining);
    setPendingPackageData({
      customerId: renewPkg.customerId,
      childId: renewPkg.childId,
      type: renewPlanName || renewPkg.type,
      hours: renewHours,
      price: renewPrice,
      expiryDays: renewExpiryDays,
      unitId: currentUnit,
    });
    setSelectedCustomer(customer);
    setSelectedChild(child || null);
    setShowRenewModal(false);
    setShowPaymentModal(true);
  };

  // === Impressão de Resumo do Pacote ===
  const openPrintModal = (pkg: Package) => {
    setPrintPkg(pkg);
    setShowPrintModal(true);
  };

  const getPrintData = (pkg: Package) => {
    const customerName = getCustomerName(pkg.customerId);
    const childName = pkg.childId ? getChildName(pkg.childId) : null;
    const remaining = getRemainingHours(pkg);
    const purchaseDate = pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt);
    const expDate = getExpirationDate(pkg);
    const isExpired = expDate && expDate < new Date();
    const displayPrice = getDisplayPrice(pkg);
    return { customerName, childName, remaining, purchaseDate, expDate, isExpired, displayPrice };
  };

  const handlePrintThermal = async () => {
    if (!printPkg) return;
    setPrinting(true);
    try {
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);
      if (!fiscalConfig?.enableFiscalPrint) {
        toast.error('Impressão fiscal não está habilitada nas configurações');
        return;
      }
      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) {
        toast.error('Não foi possível conectar à impressora');
        return;
      }
      const d = getPrintData(printPkg);
      const lines: string[] = [
        '================================',
        '     RESUMO DO PACOTE           ',
        '================================',
        '',
        `Cliente: ${d.customerName}`,
        d.childName ? `Crianca: ${d.childName}` : '',
        '',
        '--------------------------------',
        `Pacote: ${printPkg.type}`,
        `Horas Totais: ${printPkg.hours}h`,
        `Horas Usadas: ${printPkg.usedHours.toFixed(1)}h`,
        `Horas Restantes: ${d.remaining.toFixed(1)}h`,
        '--------------------------------',
        '',
        `Compra: ${format(d.purchaseDate, 'dd/MM/yyyy')}`,
        d.expDate ? `Vencimento: ${format(d.expDate, 'dd/MM/yyyy')}` : '',
        d.isExpired ? '*** PACOTE EXPIRADO ***' : '',
        `Status: ${printPkg.active ? 'ATIVO' : 'INATIVO'}`,
        d.displayPrice > 0 ? `Valor: R$ ${d.displayPrice.toFixed(2)}` : '',
        '',
        '================================',
        `Impresso em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        '================================',
      ].filter(Boolean);
      const printed = await bematechService.printNonFiscalReport('RESUMO DO PACOTE', lines);
      if (printed) {
        toast.success('Resumo impresso com sucesso!');
      } else {
        toast.warning('Impressora não conectada');
      }
    } catch (error) {
      console.error('Error printing package summary:', error);
      toast.error('Erro ao imprimir resumo');
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintBrowser = () => {
    if (!printPkg) return;
    const d = getPrintData(printPkg);
    const progressPct = getPackageProgress(printPkg);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resumo do Pacote</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 8px; max-width: 300px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; }
    .header h1 { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; }
    .header p { font-size: 9px; color: #64748b; margin-top: 2px; }
    .section { margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; }
    .row .label { color: #64748b; }
    .row .value { font-weight: 700; text-align: right; }
    .divider { border-top: 1px dashed #cbd5e1; margin: 6px 0; }
    .highlight { background: #f1f5f9; border-radius: 6px; padding: 8px; margin: 8px 0; text-align: center; }
    .highlight .big { font-size: 22px; font-weight: 800; color: #7c3aed; }
    .highlight .sub { font-size: 9px; color: #64748b; margin-top: 2px; }
    .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; margin: 4px 0; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; background: ${progressPct >= 90 ? '#ef4444' : progressPct >= 70 ? '#f59e0b' : '#7c3aed'}; }
    .expired { color: #dc2626; font-weight: 700; text-align: center; padding: 4px; background: #fef2f2; border-radius: 4px; margin: 4px 0; }
    .footer { text-align: center; border-top: 2px dashed #94a3b8; padding-top: 6px; margin-top: 8px; font-size: 9px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RESUMO DO PACOTE</h1>
    <p>${printPkg.type}</p>
  </div>
  <div class="section">
    <div class="row"><span class="label">Responsável</span><span class="value">${d.customerName}</span></div>
    ${d.childName ? `<div class="row"><span class="label">Criança</span><span class="value">${d.childName}</span></div>` : ''}
    <div class="row"><span class="label">Data da Compra</span><span class="value">${format(d.purchaseDate, 'dd/MM/yyyy')}</span></div>
    ${d.expDate ? `<div class="row"><span class="label">Vencimento</span><span class="value" style="color:${d.isExpired ? '#dc2626' : '#1e293b'}">${format(d.expDate, 'dd/MM/yyyy')}</span></div>` : ''}
    ${d.displayPrice > 0 ? `<div class="row"><span class="label">Valor Pago</span><span class="value">R$ ${d.displayPrice.toFixed(2)}</span></div>` : ''}
    <div class="row"><span class="label">Status</span><span class="value" style="color:${printPkg.active ? '#059669' : '#dc2626'}">${printPkg.active ? 'Ativo' : 'Inativo'}</span></div>
  </div>
  <div class="divider"></div>
  <div class="section">
    <div class="row"><span class="label">Horas Totais</span><span class="value">${printPkg.hours}h</span></div>
    <div class="row"><span class="label">Horas Usadas</span><span class="value">${printPkg.usedHours.toFixed(1)}h</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
  </div>
  <div class="highlight">
    <div class="big">${d.remaining.toFixed(1)}h</div>
    <div class="sub">horas restantes</div>
  </div>
  ${d.isExpired ? '<div class="expired">PACOTE EXPIRADO</div>' : ''}
  <div class="footer">
    <p>Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
    }
    toast.success('Janela de impressão aberta!');
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await packagesServiceOffline.updatePackage(id, { active: !currentStatus });
      toast.success(`Pacote ${!currentStatus ? 'ativado' : 'desativado'}!`);
      loadData();
    } catch (error) {
      console.error('Error toggling package:', error);
      toast.error('Erro ao atualizar pacote');
    }
  };

  const getPackageProgress = (pkg: Package) => Math.min((pkg.usedHours / pkg.hours) * 100, 100);
  const getRemainingHours = (pkg: Package) => Math.max(pkg.hours - pkg.usedHours, 0);
  // Mesma lógica de validade usada no serviço (Gestão de Clientes / Checkout),
  // com fallback de expiryDays por plano para pacotes legados sem expiryDays.
  const getExpirationDate = (pkg: Package): Date | null => getPackageExpiryDate(pkg, plans);
  const getDisplayPrice = (pkg: Package): number => {
    if (pkg.price > 0) return pkg.price;
    // Match by hours from configured plans
    const matchedPlan = plans.find(p => p.hours === pkg.hours);
    return matchedPlan?.price || 0;
  };
  const getChildName = (childId: string) => children.find(c => c.id === childId)?.name || '-';
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || '-';
  const getCustomerChildren = (customerId: string) => children.filter(c => c.customerId === customerId);

  const isVigente = (pkg: Package) => {
    if (!pkg.active) return false;
    if (pkg.usedHours >= pkg.hours) return false;
    const exp = getExpirationDate(pkg);
    if (exp && exp < new Date()) return false;
    return true;
  };
  const displayedPackages = showActiveOnly ? packages.filter(isVigente) : packages;
  const vigenteCount = packages.filter(isVigente).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestão de pacotes"
        subtitle={`${displayedPackages.length} pacotes ${showActiveOnly ? '' : `(${vigenteCount} vigentes)`}`}
        actions={
          <Button variant="outline" onClick={loadData} loading={loading} iconLeft={<RefreshIcon size={16} />}>
            Atualizar
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-5 border-b border-line" role="tablist">
        <button
          onClick={() => setActiveTab('packages')}
          className={cn(
            'pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors',
            'focus-visible:outline-none focus-visible:shadow-focus',
            activeTab === 'packages'
              ? 'border-brand-600 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-800',
          )}
        >
          Pacotes Vendidos
        </button>
        <button
          onClick={() => {
            if (!adminAuth) {
              setPendingAction('plans');
              return;
            }
            setActiveTab('plans');
          }}
          className={cn(
            'pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors',
            'focus-visible:outline-none focus-visible:shadow-focus',
            activeTab === 'plans'
              ? 'border-brand-600 text-ink-900'
              : 'border-transparent text-ink-500 hover:text-ink-800',
          )}
        >
          Configurar Planos
        </button>
      </div>

      {/* Tab: Configurar Planos */}
      {activeTab === 'plans' && (
        <div className="space-y-5">
          <div className="bg-paper-raised rounded-card border border-line p-5">
            <h2 className="text-lg font-bold text-ink-900 mb-1">Planos Disponíveis</h2>
            <p className="text-xs text-ink-500 mb-4">Estes planos aparecem na tela de Vender Pacote e no formulário de novo pacote.</p>

            {/* Plan Form */}
            <div className="bg-paper border border-line rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-ink-700 mb-3">{editingPlanIdx !== null ? 'Editar Plano' : 'Adicionar Plano'}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-1">
                  <label className="block text-xs font-medium text-ink-600 mb-1">Nome</label>
                  <input type="text" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} placeholder="Ex: Pacote 10h" className="w-full px-3 py-2 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Horas</label>
                  <input type="number" value={newPlan.hours} onChange={e => setNewPlan({ ...newPlan, hours: parseFloat(e.target.value) })} min="1" step="0.5" className="w-full px-3 py-2 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Preço (R$)</label>
                  <input type="number" value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: parseFloat(e.target.value) })} min="0" step="0.01" className="w-full px-3 py-2 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Validade (dias)</label>
                  <input type="number" value={newPlan.expiryDays} onChange={e => setNewPlan({ ...newPlan, expiryDays: parseInt(e.target.value) })} min="1" className="w-full px-3 py-2 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={handleSavePlan} className="flex-1 bg-brand-gradient hover:brightness-110 shadow-brand-sm text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                    {editingPlanIdx !== null ? 'Salvar' : 'Adicionar'}
                  </button>
                  {editingPlanIdx !== null && (
                    <button onClick={() => { setEditingPlanIdx(null); setNewPlan({ name: '', hours: 10, price: 300, expiryDays: 30 }); }} className="px-3 py-2 rounded-lg text-sm border border-line-strong text-ink-600 hover:bg-ink-100 transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Plans List */}
            {plans.length === 0 ? (
              <p className="text-center text-ink-400 py-8 text-sm">Nenhum plano configurado. Adicione acima.</p>
            ) : (
              <div className="space-y-2">
                {plans.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-line rounded-lg hover:bg-paper transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-ink-100 rounded-md flex items-center justify-center"><svg className="w-4 h-4 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg></div>
                      <div>
                        <p className="font-semibold text-sm text-ink-800">{plan.name}</p>
                        <p className="text-xs text-ink-500">{plan.hours}h &middot; {plan.expiryDays} dias &middot; {formatBRL(plan.price / plan.hours)}/h</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-ink-900 tabular-nums">{formatBRL(plan.price)}</span>
                      <button onClick={() => handleEditPlan(idx)} className="p-1.5 rounded-md hover:bg-ink-100 text-ink-500 hover:text-ink-800 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg></button>
                      <button onClick={() => handleDeletePlan(idx)} className="p-1.5 rounded-md hover:bg-danger-50 text-ink-400 hover:text-danger-600 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Pacotes Vendidos */}
      {activeTab === 'packages' && (
        <Card padding="none">
          <div className="flex items-center justify-between px-4 h-12 border-b border-line gap-4">
            <div className="flex-1 max-w-xs">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, criança ou pacote…"
                iconLeft={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer flex-shrink-0 px-3 py-2 rounded-lg hover:bg-paper transition-all">
              <div className="relative">
                <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} className="sr-only peer" />
                <div className="w-8 h-[18px] bg-ink-300 rounded-full peer-checked:bg-brand-600 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-paper-raised rounded-full shadow-sm transition-transform peer-checked:translate-x-[14px]"></div>
              </div>
              <span className="text-xs text-ink-700 font-semibold">Apenas vigentes</span>
            </label>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : displayedPackages.length === 0 ? (
            <EmptyState
              icon={<PackageIcon size={28} />}
              title="Nenhum pacote encontrado"
              description="Tente mudar o filtro ou busca"
            />
          ) : (
            <div className="divide-y divide-line-subtle/60">
              {displayedPackages.filter((pkg) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                const customerName = getCustomerName(pkg.customerId).toLowerCase();
                const childName = pkg.childId ? getChildName(pkg.childId).toLowerCase() : '';
                return customerName.includes(term) || childName.includes(term) || pkg.type.toLowerCase().includes(term);
              }).map((pkg) => {
                const progress = getPackageProgress(pkg);
                const remainingPct = 100 - progress;
                const expirationDate = getExpirationDate(pkg);
                const isExpired = expirationDate && expirationDate < new Date();
                const progressColor = remainingPct <= 10 ? 'bg-clock-over' : remainingPct <= 30 ? 'bg-clock-watch' : 'bg-state-ok';
                const totalH = pkg.hours;
                const remainH = getRemainingHours(pkg);

                return (
                  <div key={pkg.id} className={`px-4 py-2.5 hover:bg-paper transition-colors ${!pkg.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-ink-900 text-sm">{pkg.type}</p>
                          {!pkg.active ? (
                            <Badge tone="slate" size="sm">Inativo</Badge>
                          ) : isExpired ? (
                            <Badge tone="red" size="sm">Expirado</Badge>
                          ) : remainH <= 0 ? (
                            <Badge tone="amber" size="sm">Esgotado</Badge>
                          ) : null}
                          {(pkg as any).employeeDiscount && <Badge tone="brand" size="sm">Colaborador</Badge>}
                        </div>
                        <p className="text-xs text-ink-500 truncate mt-0.5">
                          {getCustomerName(pkg.customerId)}
                          {pkg.childId ? ` · ${getChildName(pkg.childId)}` : ''}
                          {` · comprado ${format(pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt), 'dd/MM/yy')}`}
                        </p>
                      </div>

                      {/* Saldo é o dado que decide se o cliente pode usar o
                          pacote agora — vai em destaque, com a barra logo abaixo. */}
                      <div className="w-44 hidden md:block flex-shrink-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`font-mono text-sm font-medium tabular-nums ${remainingPct <= 10 ? 'text-clock-over' : remainingPct <= 30 ? 'text-clock-watch' : 'text-ink-900'}`}>
                            {remainH.toFixed(1)}h
                          </span>
                          <span className="text-[11px] text-ink-400 tabular-nums">de {totalH.toFixed(1)}h</span>
                        </div>
                        <div className="w-full bg-ink-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.max(0, 100 - progress)}%` }} />
                        </div>
                      </div>

                      <div className="w-24 hidden lg:block flex-shrink-0 text-right">
                        {expirationDate ? (() => {
                          const daysLeft = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          const expTone = isExpired ? 'text-clock-over' : daysLeft <= 7 ? 'text-clock-watch' : 'text-ink-500';
                          return (
                            <>
                              <p className={`text-xs font-medium tabular-nums ${expTone}`}>
                                {isExpired ? 'expirado' : daysLeft <= 7 ? `vence em ${daysLeft}d` : format(expirationDate, 'dd/MM/yy')}
                              </p>
                              {!isExpired && daysLeft > 7 && <p className="text-[11px] text-ink-400">validade</p>}
                            </>
                          );
                        })() : (
                          <p className="text-xs text-ink-300">—</p>
                        )}
                      </div>

                      <div className="w-24 flex-shrink-0 text-right">
                        {(pkg as any).employeeDiscount && (pkg as any).originalPrice && (
                          <span className="text-[11px] text-ink-400 line-through block tabular-nums">{formatBRL((pkg as any).originalPrice)}</span>
                        )}
                        {(() => {
                          const displayPrice = getDisplayPrice(pkg);
                          const isEstimated = pkg.price === 0 && displayPrice > 0;
                          return (
                            <>
                              <span className={`text-sm font-semibold tabular-nums ${displayPrice > 0 ? 'text-ink-800' : 'text-ink-300'}`}>
                                {isEstimated ? '~' : ''}{formatBRL(displayPrice)}
                              </span>
                              {isEstimated && <p className="text-[11px] text-ink-400">via plano</p>}
                            </>
                          );
                        })()}
                      </div>

                      {/* Ações em tom neutro: cinco ícones em cinco cores viram
                          um arco-íris e nenhuma delas significa estado. */}
                      <div className="flex gap-0.5 flex-shrink-0">
                        {pkg.active && (
                          <IconButton variant="ghost" size="sm" onClick={() => openRenewModal(pkg)} aria-label={`Renovar ${pkg.type}`} title="Renovar pacote">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"/></svg>
                          </IconButton>
                        )}
                        <IconButton variant="ghost" size="sm" onClick={() => openPrintModal(pkg)} aria-label={`Imprimir resumo de ${pkg.type}`} title="Imprimir resumo">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </IconButton>
                        <IconButton variant="ghost" size="sm" onClick={() => openAdjustHoursModal(pkg)} aria-label={`Ajustar horas de ${pkg.type}`} title="Ajustar horas (admin)">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </IconButton>
                        <IconButton variant="ghost" size="sm" onClick={() => openModal(pkg)} aria-label={`Editar ${pkg.type}`} title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </IconButton>
                        <IconButton variant="ghost" size="sm" onClick={() => handleToggleActive(pkg.id, pkg.active)} aria-label={pkg.active ? `Desativar ${pkg.type}` : `Ativar ${pkg.type}`} title={pkg.active ? 'Desativar' : 'Ativar'}>
                          {pkg.active ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          )}
                        </IconButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Modal Criar/Editar Pacote */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="text-lg font-bold text-ink-900">{editingPackage ? 'Editar Pacote' : 'Novo Pacote'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1.5">Responsável *</label>
                <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value, childId: undefined })} className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" required>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {formData.customerId && getCustomerChildren(formData.customerId).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Criança (opcional)</label>
                  <select value={formData.childId || ''} onChange={(e) => setFormData({ ...formData, childId: e.target.value || undefined })} className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500">
                    <option value="">Todas as crianças</option>
                    {getCustomerChildren(formData.customerId).map(ch => <option key={ch.id} value={ch.id}>{ch.name} ({getChildAge(ch)} anos)</option>)}
                  </select>
                </div>
              )}

              {!editingPackage && plans.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Plano</label>
                  <div className="grid grid-cols-2 gap-2">
                    {plans.map(p => (
                      <button key={p.name} type="button" onClick={() => setFormData({ ...formData, type: p.name, hours: p.hours, price: p.price, expiryDays: p.expiryDays })}
                        className={`p-3 rounded-lg border text-left text-sm transition-all ${formData.type === p.name ? 'border-violet-500 bg-brand-50' : 'border-line hover:border-violet-300'}`}>
                        <p className="font-semibold text-ink-800">{p.name}</p>
                        <p className="text-xs text-ink-500">{p.hours}h &middot; {formatBRL(p.price)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Horas</label>
                  <input type="number" value={formData.hours} onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })} min="1" step="0.5" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Preço (R$)</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} min="0" step="0.01" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Validade</label>
                  <select value={formData.expiryDays || 30} onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) })} className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500">
                    <option value="15">15 dias</option>
                    <option value="30">30 dias</option>
                    <option value="45">45 dias</option>
                    <option value="60">60 dias</option>
                    <option value="90">90 dias</option>
                    <option value="120">120 dias</option>
                    <option value="180">180 dias</option>
                    <option value="365">1 ano</option>
                  </select>
                </div>
              </div>

              {editingPackage && (
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Data de Expiração</label>
                  <input
                    type="date"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500"
                  />
                  <p className="text-[10px] text-ink-400 mt-1">Altere para definir uma data de expiração personalizada</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-gradient hover:brightness-110 shadow-brand-sm text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Salvando...' : (editingPackage ? 'Salvar' : 'Criar Pacote')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Auth */}
      {(pendingEditPkg || pendingAction) && !adminAuth && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="text-lg font-bold text-ink-900">Autenticação Admin</h2>
              <button onClick={() => { setPendingEditPkg(null); setPendingAction(null); setAdminPasswordInput(''); }} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-ink-600">
                {pendingAction === 'plans' ? 'Configurar planos requer senha de administrador.' : pendingAction === 'adjustHours' ? 'Ajustar horas de pacote requer senha de administrador.' : 'Editar pacotes vendidos requer senha de administrador.'}
              </p>
              <input type="password" value={adminPasswordInput} onChange={e => setAdminPasswordInput(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (adminPasswordInput === ADMIN_PASSWORD) {
                    setAdminAuth(true); setAdminPasswordInput('');
                    const action = pendingAction; const pkg = pendingEditPkg;
                    setPendingEditPkg(null); setPendingAction(null);
                    if (action === 'plans') { setActiveTab('plans'); }
                    else if (action === 'adjustHours' && pkg) { openAdjustHoursModal(pkg); }
                    else if (pkg) { openModal(pkg); }
                  } else { toast.error('Senha incorreta'); setAdminPasswordInput(''); }
                }
              }} placeholder="Senha admin" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus focus:border-brand-500" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => { setPendingEditPkg(null); setPendingAction(null); setAdminPasswordInput(''); }} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper">Cancelar</button>
                <button onClick={() => {
                  if (adminPasswordInput === ADMIN_PASSWORD) {
                    setAdminAuth(true); setAdminPasswordInput('');
                    const action = pendingAction; const pkg = pendingEditPkg;
                    setPendingEditPkg(null); setPendingAction(null);
                    if (action === 'plans') { setActiveTab('plans'); }
                    else if (action === 'adjustHours' && pkg) { openAdjustHoursModal(pkg); }
                    else if (pkg) { openModal(pkg); }
                  } else { toast.error('Senha incorreta'); setAdminPasswordInput(''); }
                }} className="flex-1 py-2.5 rounded-lg bg-brand-gradient hover:brightness-110 shadow-brand-sm text-white text-sm font-semibold">Entrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustar Horas (Admin) */}
      {showAdjustModal && adjustPkg && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Ajustar Horas do Pacote</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  {adjustPkg.type} &middot; {getCustomerName(adjustPkg.customerId)}
                  {adjustPkg.childId ? ` · ${getChildName(adjustPkg.childId)}` : ''}
                </p>
              </div>
              <button onClick={() => { setShowAdjustModal(false); setAdjustPkg(null); }} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-state-warn-soft border border-state-warn/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-state-warn">Valores atuais</p>
                <p className="text-sm text-state-warn mt-1">
                  {adjustPkg.hours}h total &middot; {adjustPkg.usedHours.toFixed(1)}h usadas &middot; {getRemainingHours(adjustPkg).toFixed(1)}h restantes
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Horas Totais</label>
                  <input type="number" value={adjustHours} onChange={(e) => setAdjustHours(parseFloat(e.target.value) || 0)} min="0.5" step="0.5" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-600 mb-1.5">Horas Usadas</label>
                  <input type="number" value={adjustUsedHours} onChange={(e) => setAdjustUsedHours(parseFloat(e.target.value) || 0)} min="0" step="0.5" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus" />
                </div>
              </div>

              {adjustHours > 0 && (
                <div className="bg-paper rounded-lg p-3">
                  <p className="text-xs text-ink-500">Resultado após ajuste:</p>
                  <p className="text-sm font-bold text-ink-900 mt-0.5">
                    {adjustHours}h total &middot; {adjustUsedHours.toFixed(1)}h usadas &middot; {Math.max(0, adjustHours - adjustUsedHours).toFixed(1)}h restantes
                  </p>
                  {adjustUsedHours >= adjustHours && (
                    <p className="text-[11px] text-state-bad font-semibold mt-1">O pacote será marcado como inativo (horas esgotadas)</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1.5">Motivo do ajuste</label>
                <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Ex: Erro no lançamento, compensação ao cliente..." rows={2} className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowAdjustModal(false); setAdjustPkg(null); }} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors">Cancelar</button>
                <button onClick={handleAdjustHours} disabled={adjustSaving} className="flex-1 py-2.5 rounded-lg bg-state-warn hover:bg-state-warn text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{adjustSaving ? 'Salvando...' : 'Confirmar Ajuste'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Imprimir Resumo do Pacote */}
      {showPrintModal && printPkg && (() => {
        const d = getPrintData(printPkg);
        const progressPct = getPackageProgress(printPkg);
        const remainingPct = 100 - progressPct;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-md w-full">
              <div className="flex items-center justify-between p-5 border-b border-line">
                <h2 className="text-lg font-bold text-ink-900">Imprimir Resumo do Pacote</h2>
                <button onClick={() => { setShowPrintModal(false); setPrintPkg(null); }} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Preview */}
                <div className="bg-paper rounded-card p-4 space-y-3 border border-line">
                  <div className="text-center">
                    <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">Resumo do Pacote</p>
                    <p className="text-base font-bold text-ink-900 mt-0.5">{printPkg.type}</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-ink-500">Responsável</span><span className="font-semibold text-ink-800">{d.customerName}</span></div>
                    {d.childName && <div className="flex justify-between"><span className="text-ink-500">Criança</span><span className="font-semibold text-ink-800">{d.childName}</span></div>}
                    <div className="flex justify-between"><span className="text-ink-500">Data da Compra</span><span className="font-semibold text-ink-800">{format(d.purchaseDate, 'dd/MM/yyyy')}</span></div>
                    {d.expDate && <div className="flex justify-between"><span className="text-ink-500">Vencimento</span><span className={`font-semibold ${d.isExpired ? 'text-state-bad' : 'text-ink-800'}`}>{format(d.expDate, 'dd/MM/yyyy')}</span></div>}
                    <div className="flex justify-between"><span className="text-ink-500">Status</span><span className={`font-semibold ${printPkg.active ? 'text-state-ok' : 'text-state-bad'}`}>{printPkg.active ? 'Ativo' : 'Inativo'}</span></div>
                  </div>
                  <div className="border-t border-line pt-3">
                    <div className="flex justify-between text-xs text-ink-500 mb-1">
                      <span>{printPkg.usedHours.toFixed(1)}h / {printPkg.hours}h</span>
                      <span className={`font-bold ${remainingPct <= 10 ? 'text-state-bad' : remainingPct <= 30 ? 'text-state-warn' : 'text-state-ok'}`}>{d.remaining.toFixed(1)}h restantes</span>
                    </div>
                    <div className="w-full bg-ink-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${progressPct >= 90 ? 'bg-state-bad' : progressPct >= 70 ? 'bg-state-warn' : 'bg-brand-500'}`} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  {d.isExpired && <p className="text-center text-xs font-bold text-state-bad bg-state-bad-soft rounded-lg py-1.5">PACOTE EXPIRADO</p>}
                </div>

                {/* Print Options */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-ink-600 uppercase tracking-wider">Escolha a forma de impressão</p>
                  <button
                    onClick={handlePrintThermal}
                    disabled={printing}
                    className="w-full flex items-center gap-3 p-3.5 rounded-card border border-line hover:border-violet-300 hover:bg-brand-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V12" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-ink-800">Impressora Térmica</p>
                      <p className="text-xs text-ink-500">Imprime na impressora Bematech configurada</p>
                    </div>
                  </button>
                  <button
                    onClick={handlePrintBrowser}
                    className="w-full flex items-center gap-3 p-3.5 rounded-card border border-line hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-ink-800">Imprimir via Navegador</p>
                      <p className="text-xs text-ink-500">Abre janela de impressão do sistema (qualquer impressora)</p>
                    </div>
                  </button>
                </div>

                <button onClick={() => { setShowPrintModal(false); setPrintPkg(null); }} className="w-full py-2.5 rounded-card border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors">Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Renovar Pacote */}
      {showRenewModal && renewPkg && (() => {
        const remaining = getRemainingHours(renewPkg);
        const expDate = getExpirationDate(renewPkg);
        const isExpired = expDate && expDate < new Date();
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-line">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Renovar Pacote</h2>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {getCustomerName(renewPkg.customerId)}
                    {renewPkg.childId ? ` · ${getChildName(renewPkg.childId)}` : ''}
                  </p>
                </div>
                <button onClick={() => { setShowRenewModal(false); setRenewPkg(null); }} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Current package info */}
                <div className="bg-state-warn-soft border border-state-warn/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-state-warn">Pacote Atual — {renewPkg.type}</p>
                  <div className="mt-1.5 space-y-1 text-sm text-state-warn">
                    <div className="flex justify-between">
                      <span>Horas restantes</span>
                      <span className="font-bold">{remaining.toFixed(1)}h</span>
                    </div>
                    {expDate && (
                      <div className="flex justify-between">
                        <span>Vencimento</span>
                        <span className={`font-bold ${isExpired ? 'text-state-bad' : ''}`}>
                          {format(expDate, 'dd/MM/yyyy')}{isExpired ? ' (expirado)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan selection */}
                {plans.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-ink-600 mb-1.5">Escolha o plano para renovação</label>
                    <div className="grid grid-cols-2 gap-2">
                      {plans.map(p => (
                        <button key={p.name} type="button" onClick={() => {
                          setRenewHours(p.hours);
                          setRenewPrice(p.price);
                          setRenewExpiryDays(p.expiryDays);
                          setRenewPlanName(p.name);
                        }}
                          className={`p-3 rounded-lg border text-left text-sm transition-all ${
                            renewPlanName === p.name ? 'border-state-ok bg-state-ok-soft' : 'border-line hover:border-state-ok/30'
                          }`}>
                          <p className="font-semibold text-ink-800">{p.name}</p>
                          <p className="text-xs text-ink-500">{p.hours}h · {formatBRL(p.price)} · {p.expiryDays}d</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom values */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-600 mb-1.5">Horas Adicionais</label>
                    <input type="number" value={renewHours} onChange={(e) => setRenewHours(parseFloat(e.target.value) || 0)} min="1" step="0.5" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-600 mb-1.5">Preço (R$)</label>
                    <input type="number" value={renewPrice} onChange={(e) => setRenewPrice(parseFloat(e.target.value) || 0)} min="0" step="0.01" className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-600 mb-1.5">Validade</label>
                    <select value={renewExpiryDays} onChange={(e) => setRenewExpiryDays(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus">
                      <option value="15">15 dias</option>
                      <option value="30">30 dias</option>
                      <option value="45">45 dias</option>
                      <option value="60">60 dias</option>
                      <option value="90">90 dias</option>
                      <option value="120">120 dias</option>
                      <option value="180">180 dias</option>
                      <option value="365">1 ano</option>
                    </select>
                  </div>
                </div>

                {/* Preview result */}
                <div className="bg-state-ok-soft border border-state-ok/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-state-ok">Resultado após renovação</p>
                  <div className="mt-1.5 space-y-1 text-sm text-state-ok">
                    <div className="flex justify-between">
                      <span>Horas restantes atuais</span>
                      <span className="font-semibold">{remaining.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+ Horas adicionais</span>
                      <span className="font-semibold">+{renewHours}h</span>
                    </div>
                    <div className="flex justify-between border-t border-state-ok/30 pt-1 mt-1">
                      <span className="font-bold">Total de Horas</span>
                      <span className="font-bold text-lg">{(remaining + renewHours).toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nova validade</span>
                      <span className="font-semibold">{renewExpiryDays} dias a partir de hoje</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowRenewModal(false); setRenewPkg(null); }} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors">Cancelar</button>
                  <button onClick={handleConfirmRenewal} disabled={renewHours <= 0 || renewPrice <= 0} className="flex-1 py-2.5 rounded-lg bg-state-ok hover:bg-[#166b4c] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Ir para Pagamento</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Pagamento */}
      {showPaymentModal && pendingPackageData && selectedCustomer && (
        <PackagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setPendingPackageData(null); setSelectedChild(null); setSelectedCustomer(null); setRenewalPackageId(null); setRenewalRemainingHours(0); }}
          onSuccess={handlePaymentSuccess}
          packageData={pendingPackageData}
          child={selectedChild || undefined}
          customer={selectedCustomer}
          renewalPackageId={renewalPackageId || undefined}
          remainingHours={renewalRemainingHours}
        />
      )}
    </div>
  );
};

export default Packages;
