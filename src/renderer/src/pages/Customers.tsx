import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child, Package } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { useUnit } from '../contexts/UnitContext';
import { getChildAge } from '../../../shared/utils/age';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  address: string;
}

interface ChildFormData {
  name: string;
  birthDate: string;
  enrollmentCode: string;
  customerId: string;
}

const Customers: React.FC = () => {
  const { currentUnit } = useUnit();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    address: '',
  });

  const [childFormData, setChildFormData] = useState<ChildFormData>({
    name: '',
    birthDate: '',
    enrollmentCode: '',
    customerId: '',
  });

  useEffect(() => {
    loadData();
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allCustomers, allChildren, unitPackages] = await Promise.all([
        customersServiceOffline.getAllCustomers(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        packagesServiceOffline.getActivePackages(undefined, currentUnit),
      ]);
      setCustomers(allCustomers);
      setChildren(allChildren);
      setPackages(unitPackages);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      loadData();
      return;
    }
    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setCustomers(filtered);
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        cpf: customer.cpf || '',
        address: customer.address || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', cpf: '', address: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await customersServiceOffline.updateCustomer(editingCustomer.id, formData);
        toast.success('✅ Cliente atualizado com sucesso!');
      } else {
        await customersServiceOffline.createCustomer({ ...formData, unitId: currentUnit });
        toast.success('✅ Cliente cadastrado com sucesso!');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };


  const openChildModal = (customerId: string, child?: Child) => {
    if (child) {
      setEditingChild(child);
      const bd = child.birthDate
        ? (typeof child.birthDate === 'string' ? child.birthDate : new Date(child.birthDate).toISOString().split('T')[0])
        : '';
      setChildFormData({ name: child.name, birthDate: bd, enrollmentCode: child.enrollmentCode || '', customerId });
    } else {
      setEditingChild(null);
      setChildFormData({ name: '', birthDate: '', enrollmentCode: '', customerId });
    }
    setShowChildModal(true);
  };

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    
    if (!childFormData.name || !childFormData.birthDate) {
      toast.error('Nome e data de nascimento são obrigatórios');
      return;
    }

    setSaving(true);
    const birthDateObj = new Date(childFormData.birthDate + 'T00:00:00');
    const age = getChildAge({ age: 0, birthDate: birthDateObj });

    try {
      if (editingChild) {
        await customersServiceOffline.updateChild(editingChild.id, {
          name: childFormData.name,
          age,
          birthDate: birthDateObj,
          enrollmentCode: childFormData.enrollmentCode || undefined,
        });
        toast.success('✅ Criança atualizada com sucesso!');
      } else {
        await customersServiceOffline.addChild(childFormData.customerId, {
          name: childFormData.name,
          age,
          birthDate: birthDateObj,
          enrollmentCode: childFormData.enrollmentCode || undefined,
          unitId: currentUnit,
        });
        toast.success('✅ Criança cadastrada com sucesso!');
      }
      setEditingChild(null);
      setChildFormData({ name: '', birthDate: '', enrollmentCode: '', customerId: '' });
      setShowChildModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving child:', error);
      toast.error('Erro ao salvar criança');
    } finally {
      setSaving(false);
    }
  };

  const getCustomerChildren = (customerId: string) => {
    return children.filter(c => c.customerId === customerId);
  };

  const getCustomerPackages = (customerId: string) => {
    return packages.filter(p => p.customerId === customerId && p.active);
  };

  const getCustomerRemainingHours = (customerId: string): number => {
    const pkgs = getCustomerPackages(customerId);
    return pkgs.reduce((sum, p) => sum + Math.max(0, p.hours - p.usedHours), 0);
  };

  const filteredCustomers = searchTerm
    ? customers.filter(c => {
        const term = searchTerm.toLowerCase();
        const matchesCustomer =
          c.name.toLowerCase().includes(term) ||
          c.phone.includes(searchTerm) ||
          (c.email && c.email.toLowerCase().includes(term));
        const matchesChild = children
          .filter(ch => ch.customerId === c.id)
          .some(ch => ch.name.toLowerCase().includes(term));
        return matchesCustomer || matchesChild;
      })
    : customers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500">{customers.length} cadastrados</p>
        </div>
        <button onClick={() => openModal()} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm">
          + Novo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por responsável, criança, telefone ou email..."
          className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        {searchTerm && (
          <button onClick={() => { setSearchTerm(''); loadData(); }} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">Limpar</button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">👥</p>
            <p className="font-medium">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => {
              const custChildren = getCustomerChildren(customer.id);
              return (
                <div key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}>
                        <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm">{customer.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>{customer.phone}</span>
                            {customer.email && <><span className="text-slate-300">|</span><span className="truncate">{customer.email}</span></>}
                            {customer.cpf && <><span className="text-slate-300">|</span><span>{customer.cpf}</span></>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {/* Remaining hours badge */}
                        {(() => {
                          const remaining = getCustomerRemainingHours(customer.id);
                          if (remaining > 0) {
                            const hours = Math.floor(remaining);
                            const mins = Math.round((remaining - hours) * 60);
                            return (
                              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                ⏱ {hours}h{mins > 0 ? `${mins}m` : ''} restantes
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {/* Children badges */}
                        <div className="hidden md:flex items-center gap-1">
                          {custChildren.length === 0 ? (
                            <span className="text-xs text-slate-400">Sem crianças</span>
                          ) : (
                            custChildren.map(ch => (
                              <span key={ch.id} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => openChildModal(customer.id, ch)} title={ch.enrollmentCode ? `Matrícula: ${ch.enrollmentCode}` : 'Clique para editar'}>
                                {ch.name} ({getChildAge(ch)}a){ch.enrollmentCode ? ` [${ch.enrollmentCode}]` : ''} ✏️
                              </span>
                            ))
                          )}
                        </div>

                        <button onClick={() => openChildModal(customer.id)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm" title="Adicionar criança">👶+</button>
                        <button onClick={() => openModal(customer)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm" title="Editar">✏️</button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Package details */}
                  {expandedCustomer === customer.id && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Pacotes Ativos</p>
                        {getCustomerPackages(customer.id).length === 0 ? (
                          <p className="text-xs text-slate-400">Nenhum pacote ativo</p>
                        ) : (
                          <div className="space-y-1.5">
                            {getCustomerPackages(customer.id).map(pkg => {
                              const remaining = Math.max(0, pkg.hours - pkg.usedHours);
                              const remainingH = Math.floor(remaining);
                              const remainingM = Math.round((remaining - remainingH) * 60);
                              const pct = pkg.hours > 0 ? ((pkg.hours - remaining) / pkg.hours) * 100 : 100;
                              return (
                                <div key={pkg.id} className="bg-white rounded-md p-2.5 border border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700">{pkg.type}</span>
                                    <span className={`text-[11px] font-bold ${remaining > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {remainingH}h{remainingM > 0 ? `${remainingM}m` : ''} restantes
                                    </span>
                                  </div>
                                  <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">{pkg.usedHours.toFixed(1)}h usadas de {pkg.hours}h</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome Completo *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefone *</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">CPF</label>
                  <input type="text" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Endereço</label>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Salvando...' : (editingCustomer ? 'Salvar' : 'Cadastrar')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criança */}
      {showChildModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingChild ? 'Editar Criança' : 'Adicionar Criança'}</h2>
              <button onClick={() => { setShowChildModal(false); setEditingChild(null); }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <form onSubmit={handleChildSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Matrícula</label>
                <input type="text" value={childFormData.enrollmentCode || ''} onChange={(e) => setChildFormData({ ...childFormData, enrollmentCode: e.target.value.toUpperCase() })} placeholder="Código do sistema anterior" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:font-sans" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome *</label>
                <input type="text" value={childFormData.name} onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Data de Nascimento *</label>
                <input type="date" value={childFormData.birthDate} onChange={(e) => setChildFormData({ ...childFormData, birthDate: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
                {childFormData.birthDate && (
                  <p className="text-xs text-slate-500 mt-1">Idade: {getChildAge({ age: 0, birthDate: new Date(childFormData.birthDate + 'T00:00:00') })} anos</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowChildModal(false); setEditingChild(null); }} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Salvando...' : (editingChild ? 'Salvar' : 'Adicionar')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
