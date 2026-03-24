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
        await packagesServiceOffline.updatePackage(editingPackage.id, {
          type: formData.type,
          hours: formData.hours,
          price: formData.price,
          expiryDays: formData.expiryDays || 30,
          unitId: currentUnit,
        });
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
  const getExpirationDate = (pkg: Package): Date | null => {
    if (pkg.expiresAt) return pkg.expiresAt instanceof Date ? pkg.expiresAt : new Date(pkg.expiresAt);
    const d = pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt);
    let days = pkg.expiryDays;
    if (!days) {
      // Fallback: match by hours from configured plans
      const matchedPlan = plans.find(p => p.hours === pkg.hours);
      days = matchedPlan?.expiryDays || 90; // default 90 days
    }
    const exp = new Date(d);
    exp.setDate(exp.getDate() + days);
    return exp;
  };
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestão de Pacotes</h1>
          <p className="text-sm text-slate-500">{displayedPackages.length} pacotes {showActiveOnly ? '' : `(${vigenteCount} vigentes)`}</p>
        </div>
        <button onClick={loadData} disabled={loading} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'packages' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'plans' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Configurar Planos
        </button>
      </div>

      {/* Tab: Configurar Planos */}
      {activeTab === 'plans' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Planos Disponíveis</h2>
            <p className="text-xs text-slate-500 mb-4">Estes planos aparecem na tela de Vender Pacote e no formulário de novo pacote.</p>

            {/* Plan Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{editingPlanIdx !== null ? 'Editar Plano' : 'Adicionar Plano'}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                  <input type="text" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} placeholder="Ex: Pacote 10h" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Horas</label>
                  <input type="number" value={newPlan.hours} onChange={e => setNewPlan({ ...newPlan, hours: parseFloat(e.target.value) })} min="1" step="0.5" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preço (R$)</label>
                  <input type="number" value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: parseFloat(e.target.value) })} min="0" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Validade (dias)</label>
                  <input type="number" value={newPlan.expiryDays} onChange={e => setNewPlan({ ...newPlan, expiryDays: parseInt(e.target.value) })} min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={handleSavePlan} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                    {editingPlanIdx !== null ? 'Salvar' : 'Adicionar'}
                  </button>
                  {editingPlanIdx !== null && (
                    <button onClick={() => { setEditingPlanIdx(null); setNewPlan({ name: '', hours: 10, price: 300, expiryDays: 30 }); }} className="px-3 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Plans List */}
            {plans.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Nenhum plano configurado. Adicione acima.</p>
            ) : (
              <div className="space-y-2">
                {plans.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center"><span className="text-sm">📦</span></div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.hours}h &middot; {plan.expiryDays} dias &middot; R$ {(plan.price / plan.hours).toFixed(2)}/h</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-violet-600">R$ {plan.price.toFixed(2)}</span>
                      <button onClick={() => handleEditPlan(idx)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm">✏️</button>
                      <button onClick={() => handleDeletePlan(idx)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors text-sm">🗑️</button>
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
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome..."
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-300 placeholder:text-slate-400"
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer flex-shrink-0 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all">
              <div className="relative">
                <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-violet-500 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
              </div>
              <span className="text-xs text-slate-600 font-medium">Apenas vigentes</span>
            </label>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-16 bg-slate-100/50 rounded-xl" />
              ))}
            </div>
          ) : displayedPackages.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📦</span>
              </div>
              <p className="text-sm font-semibold text-slate-500">Nenhum pacote encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Tente mudar o filtro ou busca</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/60">
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
                const progressColor = remainingPct <= 10 ? 'bg-red-500' : remainingPct <= 30 ? 'bg-amber-500' : 'bg-emerald-500';
                const usedH = pkg.usedHours;
                const totalH = pkg.hours;
                const remainH = getRemainingHours(pkg);

                return (
                  <div key={pkg.id} className={`px-5 py-4 hover:bg-violet-50/30 transition-colors duration-150 ${!pkg.active ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-red-100' : 'bg-violet-100'}`}>
                          <span className="text-base">{isExpired ? '⏰' : '📦'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm">{pkg.type}</p>
                            {!pkg.active ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Inativo</span>
                            ) : isExpired ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Expirado</span>
                            ) : remainH <= 0 ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Esgotado</span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Vigente</span>
                            )}
                            {(pkg as any).employeeDiscount && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Desc. Colab.</span>}
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {getCustomerName(pkg.customerId)}
                            {pkg.childId ? ` · ${getChildName(pkg.childId)}` : ''}
                            {` · Compra: ${format(pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt), 'dd/MM/yyyy')}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 flex-shrink-0 ml-4">
                        {/* Progress */}
                        <div className="w-40 hidden md:block">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                            <span>{usedH.toFixed(1)}h / {totalH.toFixed(1)}h</span>
                            <span className={`font-bold ${remainingPct <= 10 ? 'text-red-600' : remainingPct <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>{remainH.toFixed(1)}h restantes</span>
                          </div>
                          <div className="w-full bg-slate-200/60 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        {/* Expiry Date */}
                        <div className="w-24 hidden md:block text-center">
                          {expirationDate ? (() => {
                            const daysLeft = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const expColor = isExpired ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-500';
                            return (
                              <div>
                                <p className={`text-[10px] font-bold ${expColor}`}>{format(expirationDate, 'dd/MM/yyyy')}</p>
                                <p className={`text-[9px] ${expColor}`}>{isExpired ? 'Expirado' : `${daysLeft}d restantes`}</p>
                              </div>
                            );
                          })() : (
                            <p className="text-[10px] text-slate-300">—</p>
                          )}
                        </div>

                        <div className="w-28 text-right">
                          {(pkg as any).employeeDiscount && (pkg as any).originalPrice && (
                            <span className="text-[10px] text-slate-400 line-through block">R$ {(pkg as any).originalPrice.toFixed(2)}</span>
                          )}
                          {(() => {
                            const displayPrice = getDisplayPrice(pkg);
                            const isEstimated = pkg.price === 0 && displayPrice > 0;
                            return (
                              <div>
                                <span className={`text-sm font-bold ${displayPrice > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                  {isEstimated ? '~' : ''}R$ {displayPrice.toFixed(2)}
                                </span>
                                {isEstimated && <p className="text-[9px] text-slate-400">via plano</p>}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="flex gap-1">
                          {pkg.active && (
                            <button onClick={() => openRenewModal(pkg)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-all" title="Renovar Pacote">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"/></svg>
                            </button>
                          )}
                          <button onClick={() => openPrintModal(pkg)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-all" title="Imprimir Resumo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button onClick={() => openAdjustHoursModal(pkg)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 transition-all" title="Ajustar Horas (Admin)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </button>
                          <button onClick={() => openModal(pkg)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-all" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => handleToggleActive(pkg.id, pkg.active)} className={`p-2 rounded-lg transition-all ${pkg.active ? 'hover:bg-red-50 text-red-400' : 'hover:bg-emerald-50 text-emerald-500'}`} title={pkg.active ? 'Desativar' : 'Ativar'}>
                            {pkg.active ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Criar/Editar Pacote */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingPackage ? 'Editar Pacote' : 'Novo Pacote'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Responsável *</label>
                <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value, childId: undefined })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required>
                  <option value="">Selecione...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {formData.customerId && getCustomerChildren(formData.customerId).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Criança (opcional)</label>
                  <select value={formData.childId || ''} onChange={(e) => setFormData({ ...formData, childId: e.target.value || undefined })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Todas as crianças</option>
                    {getCustomerChildren(formData.customerId).map(ch => <option key={ch.id} value={ch.id}>{ch.name} ({getChildAge(ch)} anos)</option>)}
                  </select>
                </div>
              )}

              {!editingPackage && plans.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plano</label>
                  <div className="grid grid-cols-2 gap-2">
                    {plans.map(p => (
                      <button key={p.name} type="button" onClick={() => setFormData({ ...formData, type: p.name, hours: p.hours, price: p.price, expiryDays: p.expiryDays })}
                        className={`p-3 rounded-lg border text-left text-sm transition-all ${formData.type === p.name ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-300'}`}>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.hours}h &middot; R$ {p.price.toFixed(2)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horas</label>
                  <input type="number" value={formData.hours} onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })} min="1" step="0.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preço (R$)</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} min="0" step="0.01" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Validade</label>
                  <select value={formData.expiryDays || 30} onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="15">15 dias</option>
                    <option value="30">30 dias</option>
                    <option value="60">60 dias</option>
                    <option value="90">90 dias</option>
                    <option value="120">120 dias</option>
                    <option value="180">180 dias</option>
                    <option value="365">1 ano</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Salvando...' : (editingPackage ? 'Salvar' : 'Criar Pacote')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Auth */}
      {(pendingEditPkg || pendingAction) && !adminAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Autenticação Admin</h2>
              <button onClick={() => { setPendingEditPkg(null); setPendingAction(null); setAdminPasswordInput(''); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
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
              }} placeholder="Senha admin" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => { setPendingEditPkg(null); setPendingAction(null); setAdminPasswordInput(''); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={() => {
                  if (adminPasswordInput === ADMIN_PASSWORD) {
                    setAdminAuth(true); setAdminPasswordInput('');
                    const action = pendingAction; const pkg = pendingEditPkg;
                    setPendingEditPkg(null); setPendingAction(null);
                    if (action === 'plans') { setActiveTab('plans'); }
                    else if (action === 'adjustHours' && pkg) { openAdjustHoursModal(pkg); }
                    else if (pkg) { openModal(pkg); }
                  } else { toast.error('Senha incorreta'); setAdminPasswordInput(''); }
                }} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">Entrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustar Horas (Admin) */}
      {showAdjustModal && adjustPkg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Ajustar Horas do Pacote</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {adjustPkg.type} &middot; {getCustomerName(adjustPkg.customerId)}
                  {adjustPkg.childId ? ` · ${getChildName(adjustPkg.childId)}` : ''}
                </p>
              </div>
              <button onClick={() => { setShowAdjustModal(false); setAdjustPkg(null); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700">Valores atuais</p>
                <p className="text-sm text-amber-800 mt-1">
                  {adjustPkg.hours}h total &middot; {adjustPkg.usedHours.toFixed(1)}h usadas &middot; {getRemainingHours(adjustPkg).toFixed(1)}h restantes
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horas Totais</label>
                  <input type="number" value={adjustHours} onChange={(e) => setAdjustHours(parseFloat(e.target.value) || 0)} min="0.5" step="0.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horas Usadas</label>
                  <input type="number" value={adjustUsedHours} onChange={(e) => setAdjustUsedHours(parseFloat(e.target.value) || 0)} min="0" step="0.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>

              {adjustHours > 0 && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Resultado após ajuste:</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {adjustHours}h total &middot; {adjustUsedHours.toFixed(1)}h usadas &middot; {Math.max(0, adjustHours - adjustUsedHours).toFixed(1)}h restantes
                  </p>
                  {adjustUsedHours >= adjustHours && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">O pacote será marcado como inativo (horas esgotadas)</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Motivo do ajuste</label>
                <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Ex: Erro no lançamento, compensação ao cliente..." rows={2} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowAdjustModal(false); setAdjustPkg(null); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button onClick={handleAdjustHours} disabled={adjustSaving} className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{adjustSaving ? 'Salvando...' : 'Confirmar Ajuste'}</button>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-800">Imprimir Resumo do Pacote</h2>
                <button onClick={() => { setShowPrintModal(false); setPrintPkg(null); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
              </div>
              <div className="p-5 space-y-4">
                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumo do Pacote</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{printPkg.type}</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Responsável</span><span className="font-semibold text-slate-800">{d.customerName}</span></div>
                    {d.childName && <div className="flex justify-between"><span className="text-slate-500">Criança</span><span className="font-semibold text-slate-800">{d.childName}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Data da Compra</span><span className="font-semibold text-slate-800">{format(d.purchaseDate, 'dd/MM/yyyy')}</span></div>
                    {d.expDate && <div className="flex justify-between"><span className="text-slate-500">Vencimento</span><span className={`font-semibold ${d.isExpired ? 'text-red-600' : 'text-slate-800'}`}>{format(d.expDate, 'dd/MM/yyyy')}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Status</span><span className={`font-semibold ${printPkg.active ? 'text-emerald-600' : 'text-red-600'}`}>{printPkg.active ? 'Ativo' : 'Inativo'}</span></div>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{printPkg.usedHours.toFixed(1)}h / {printPkg.hours}h</span>
                      <span className={`font-bold ${remainingPct <= 10 ? 'text-red-600' : remainingPct <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>{d.remaining.toFixed(1)}h restantes</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${progressPct >= 90 ? 'bg-red-500' : progressPct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  {d.isExpired && <p className="text-center text-xs font-bold text-red-600 bg-red-50 rounded-lg py-1.5">PACOTE EXPIRADO</p>}
                </div>

                {/* Print Options */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Escolha a forma de impressão</p>
                  <button
                    onClick={handlePrintThermal}
                    disabled={printing}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🖨️</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">Impressora Térmica</p>
                      <p className="text-xs text-slate-500">Imprime na impressora Bematech configurada</p>
                    </div>
                  </button>
                  <button
                    onClick={handlePrintBrowser}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📄</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">Imprimir via Navegador</p>
                      <p className="text-xs text-slate-500">Abre janela de impressão do sistema (qualquer impressora)</p>
                    </div>
                  </button>
                </div>

                <button onClick={() => { setShowPrintModal(false); setPrintPkg(null); }} className="w-full py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Fechar</button>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Renovar Pacote</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getCustomerName(renewPkg.customerId)}
                    {renewPkg.childId ? ` · ${getChildName(renewPkg.childId)}` : ''}
                  </p>
                </div>
                <button onClick={() => { setShowRenewModal(false); setRenewPkg(null); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
              </div>
              <div className="p-5 space-y-4">
                {/* Current package info */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700">Pacote Atual — {renewPkg.type}</p>
                  <div className="mt-1.5 space-y-1 text-sm text-amber-800">
                    <div className="flex justify-between">
                      <span>Horas restantes</span>
                      <span className="font-bold">{remaining.toFixed(1)}h</span>
                    </div>
                    {expDate && (
                      <div className="flex justify-between">
                        <span>Vencimento</span>
                        <span className={`font-bold ${isExpired ? 'text-red-600' : ''}`}>
                          {format(expDate, 'dd/MM/yyyy')}{isExpired ? ' (expirado)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan selection */}
                {plans.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Escolha o plano para renovação</label>
                    <div className="grid grid-cols-2 gap-2">
                      {plans.map(p => (
                        <button key={p.name} type="button" onClick={() => {
                          setRenewHours(p.hours);
                          setRenewPrice(p.price);
                          setRenewExpiryDays(p.expiryDays);
                          setRenewPlanName(p.name);
                        }}
                          className={`p-3 rounded-lg border text-left text-sm transition-all ${
                            renewPlanName === p.name ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'
                          }`}>
                          <p className="font-semibold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.hours}h · R$ {p.price.toFixed(2)} · {p.expiryDays}d</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom values */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horas Adicionais</label>
                    <input type="number" value={renewHours} onChange={(e) => setRenewHours(parseFloat(e.target.value) || 0)} min="1" step="0.5" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preço (R$)</label>
                    <input type="number" value={renewPrice} onChange={(e) => setRenewPrice(parseFloat(e.target.value) || 0)} min="0" step="0.01" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Validade</label>
                    <select value={renewExpiryDays} onChange={(e) => setRenewExpiryDays(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
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
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-emerald-700">Resultado após renovação</p>
                  <div className="mt-1.5 space-y-1 text-sm text-emerald-800">
                    <div className="flex justify-between">
                      <span>Horas restantes atuais</span>
                      <span className="font-semibold">{remaining.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>+ Horas adicionais</span>
                      <span className="font-semibold">+{renewHours}h</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-300 pt-1 mt-1">
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
                  <button onClick={() => { setShowRenewModal(false); setRenewPkg(null); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button onClick={handleConfirmRenewal} disabled={renewHours <= 0 || renewPrice <= 0} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Ir para Pagamento</button>
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
