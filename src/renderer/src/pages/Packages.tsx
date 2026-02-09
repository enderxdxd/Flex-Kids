import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Package, Customer, Child } from '../../../shared/types';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';
import { useUnit } from '../contexts/UnitContext';

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
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [activeTab, setActiveTab] = useState<'packages' | 'plans'>('packages');

  // Planos configuráveis
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [newPlan, setNewPlan] = useState<PlanConfig>({ name: '', hours: 10, price: 300, expiryDays: 30 });
  const [editingPlanIdx, setEditingPlanIdx] = useState<number | null>(null);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [pendingEditPkg, setPendingEditPkg] = useState<Package | null>(null);
  const ADMIN_PASSWORD = 'pactoflex123';

  // Estado para modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPackageData, setPendingPackageData] = useState<PackageFormData | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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
  }, [showActiveOnly, currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPackages, allCustomers, allChildren, savedPlans] = await Promise.all([
        packagesServiceOffline.getActivePackages(),
        customersServiceOffline.getAllCustomers(),
        customersServiceOffline.getAllChildren(),
        settingsServiceOffline.getPackagePlans(),
      ]);

      const unitPackages = allPackages.filter(p => p.unitId === currentUnit || p.sharedAcrossUnits);
      setPackages(showActiveOnly ? unitPackages.filter(p => p.active) : unitPackages);
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
    await settingsServiceOffline.savePackagePlans(updated);
    setPlans(updated);
    setNewPlan({ name: '', hours: 10, price: 300, expiryDays: 30 });
    toast.success(editingPlanIdx !== null ? 'Plano atualizado!' : 'Plano adicionado!');
  };

  const handleDeletePlan = async (idx: number) => {
    const updated = plans.filter((_, i) => i !== idx);
    await settingsServiceOffline.savePackagePlans(updated);
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
    if (!formData.customerId) {
      toast.error('Selecione um responsável');
      return;
    }
    try {
      if (editingPackage) {
        await packagesServiceOffline.updatePackage(editingPackage.id, {
          type: formData.type,
          hours: formData.hours,
          price: formData.price,
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
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPendingPackageData(null);
    setSelectedChild(null);
    setSelectedCustomer(null);
    setShowModal(false);
    loadData();
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
    if (pkg.expiryDays) {
      const d = pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt);
      const exp = new Date(d);
      exp.setDate(exp.getDate() + pkg.expiryDays);
      return exp;
    }
    return null;
  };
  const getChildName = (childId: string) => children.find(c => c.id === childId)?.name || '-';
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || '-';
  const getCustomerChildren = (customerId: string) => children.filter(c => c.customerId === customerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestão de Pacotes</h1>
          <p className="text-sm text-slate-500">{packages.length} pacotes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {loading ? '⏳' : '🔄'} Atualizar
          </button>
          <button onClick={() => openModal()} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm">
            + Novo Pacote
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'packages' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Pacotes Vendidos
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plans' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
              <span className="text-sm text-slate-600">Apenas ativos</span>
            </label>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-2">📦</p>
              <p className="font-medium">Nenhum pacote encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {packages.map((pkg) => {
                const progress = getPackageProgress(pkg);
                const remaining = getRemainingHours(pkg);
                const expirationDate = getExpirationDate(pkg);
                const isExpired = expirationDate && expirationDate < new Date();

                return (
                  <div key={pkg.id} className={`p-4 hover:bg-slate-50 transition-colors ${!pkg.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">📦</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 text-sm">{pkg.type}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pkg.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {pkg.active ? 'Ativo' : 'Inativo'}
                            </span>
                            {isExpired && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Expirado</span>}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {getCustomerName(pkg.customerId)}
                            {pkg.childId ? ` / ${getChildName(pkg.childId)}` : ''}
                            {expirationDate ? ` — Expira: ${format(expirationDate, 'dd/MM/yyyy')}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        {/* Progress */}
                        <div className="w-32 hidden md:block">
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>{pkg.usedHours.toFixed(1)}h / {pkg.hours}h</span>
                            <span className="font-semibold">{remaining.toFixed(1)}h restam</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        <span className="text-sm font-bold text-slate-800 w-24 text-right">R$ {pkg.price.toFixed(2)}</span>

                        <div className="flex gap-1">
                          <button onClick={() => openModal(pkg)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm" title="Editar">✏️</button>
                          <button onClick={() => handleToggleActive(pkg.id, pkg.active)} className={`p-1.5 rounded-md transition-colors text-sm ${pkg.active ? 'hover:bg-red-50 text-red-500' : 'hover:bg-emerald-50 text-emerald-600'}`} title={pkg.active ? 'Desativar' : 'Ativar'}>
                            {pkg.active ? '⏸️' : '▶️'}
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
                    {getCustomerChildren(formData.customerId).map(ch => <option key={ch.id} value={ch.id}>{ch.name} ({ch.age} anos)</option>)}
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
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors">{editingPackage ? 'Salvar' : 'Criar Pacote'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Auth */}
      {pendingEditPkg && !adminAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Autenticação Admin</h2>
              <button onClick={() => { setPendingEditPkg(null); setAdminPasswordInput(''); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">Editar pacotes vendidos requer senha de administrador.</p>
              <input type="password" value={adminPasswordInput} onChange={e => setAdminPasswordInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { if (adminPasswordInput === ADMIN_PASSWORD) { setAdminAuth(true); setAdminPasswordInput(''); const pkg = pendingEditPkg; setPendingEditPkg(null); openModal(pkg); } else { toast.error('Senha incorreta'); setAdminPasswordInput(''); } } }} placeholder="Senha admin" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => { setPendingEditPkg(null); setAdminPasswordInput(''); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={() => { if (adminPasswordInput === ADMIN_PASSWORD) { setAdminAuth(true); setAdminPasswordInput(''); const pkg = pendingEditPkg; setPendingEditPkg(null); openModal(pkg); } else { toast.error('Senha incorreta'); setAdminPasswordInput(''); } }} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">Entrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && pendingPackageData && selectedCustomer && (
        <PackagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setPendingPackageData(null); setSelectedChild(null); setSelectedCustomer(null); }}
          onSuccess={handlePaymentSuccess}
          packageData={pendingPackageData}
          child={selectedChild || undefined}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
};

export default Packages;
