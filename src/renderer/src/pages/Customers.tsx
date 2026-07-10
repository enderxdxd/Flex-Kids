import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child, Package } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { useUnit } from '../contexts/UnitContext';
import { getChildAge } from '../../../shared/utils/age';
import {
  Card, Button, IconButton, PageHeader, EmptyState, Skeleton,
  Badge, Input, cn,
} from '../components/ui';
import { PlusIcon, UsersIcon } from '../components/icons/Icons';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  address: string;
  observations: string;
}

interface ChildFormData {
  name: string;
  birthDate: string;
  cpf: string;
  enrollmentCode: string;
  observations: string;
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
  // Guarda síncrona contra duplo-submit no mesmo tick (antes do re-render de `saving`)
  const submittingRef = useRef(false);
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
    observations: '',
  });

  const [childFormData, setChildFormData] = useState<ChildFormData>({
    name: '',
    birthDate: '',
    cpf: '',
    enrollmentCode: '',
    observations: '',
    customerId: '',
  });
  const [cpfError, setCpfError] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const ADMIN_PASSWORD = 'pactoflex123';

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
        observations: customer.observations || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', cpf: '', address: '', observations: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submittingRef.current) return;

    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    // Verificar CPF duplicado
    if (formData.cpf && formData.cpf.trim()) {
      const cpfClean = formData.cpf.replace(/\D/g, '');
      const editingPhone = editingCustomer ? (editingCustomer.phone || '').replace(/\D/g, '') : '';
      if (cpfClean) {
        const duplicate = customers.find(c => {
          if (editingCustomer && c.id === editingCustomer.id) return false;
          const existingCpf = (c.cpf || '').replace(/\D/g, '');
          if (!existingCpf || existingCpf !== cpfClean) return false;
          // Ao editar, não bloquear por causa de uma duplicata acidental do
          // próprio contato (mesmo telefone) — permite corrigir/limpar duplicados.
          if (editingCustomer && editingPhone && (c.phone || '').replace(/\D/g, '') === editingPhone) return false;
          return true;
        });
        if (duplicate) {
          toast.error(`CPF já cadastrado para: ${duplicate.name}`);
          setCpfError(`CPF já cadastrado para: ${duplicate.name}`);
          return;
        }
      }
    }
    setCpfError('');

    submittingRef.current = true;
    setSaving(true);
    try {
      if (editingCustomer) {
        await customersServiceOffline.updateCustomer(editingCustomer.id, formData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await customersServiceOffline.createCustomer({ ...formData, unitId: currentUnit });
        toast.success('Cliente cadastrado com sucesso!');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };


  const openChildModal = (customerId: string, child?: Child) => {
    if (child) {
      setEditingChild(child);
      const bd = child.birthDate
        ? (typeof child.birthDate === 'string' ? child.birthDate : new Date(child.birthDate).toISOString().split('T')[0])
        : '';
      setChildFormData({ name: child.name, birthDate: bd, cpf: child.cpf || '', enrollmentCode: child.enrollmentCode || '', observations: child.observations || '', customerId });
    } else {
      setEditingChild(null);
      setChildFormData({ name: '', birthDate: '', cpf: '', enrollmentCode: '', observations: '', customerId });
    }
    setShowChildModal(true);
  };

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submittingRef.current) return;

    if (!childFormData.name || !childFormData.birthDate) {
      toast.error('Nome e data de nascimento são obrigatórios');
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    const birthDateObj = new Date(childFormData.birthDate + 'T00:00:00');
    const age = getChildAge({ age: 0, birthDate: birthDateObj });

    try {
      if (editingChild) {
        await customersServiceOffline.updateChild(editingChild.id, {
          name: childFormData.name,
          age,
          birthDate: birthDateObj,
          cpf: childFormData.cpf || undefined,
          enrollmentCode: childFormData.enrollmentCode || undefined,
          observations: childFormData.observations || undefined,
        });
        toast.success('Criança atualizada com sucesso!');
      } else {
        await customersServiceOffline.addChild(childFormData.customerId, {
          name: childFormData.name,
          age,
          birthDate: birthDateObj,
          cpf: childFormData.cpf || undefined,
          enrollmentCode: childFormData.enrollmentCode || undefined,
          observations: childFormData.observations || undefined,
          unitId: currentUnit,
        });
        toast.success('Criança cadastrada com sucesso!');
      }
      setEditingChild(null);
      setChildFormData({ name: '', birthDate: '', cpf: '', enrollmentCode: '', observations: '', customerId: '' });
      setShowChildModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving child:', error);
      toast.error('Erro ao salvar criança');
    } finally {
      setSaving(false);
      submittingRef.current = false;
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

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.unitId !== currentUnit) {
      toast.error('Não é possível excluir cliente de outra unidade');
      return;
    }
    if (deleteAdminPassword !== ADMIN_PASSWORD) {
      toast.error('Senha admin incorreta');
      return;
    }
    try {
      await customersServiceOffline.deleteCustomer(deleteTarget.id);
      toast.success(`Cliente "${deleteTarget.name}" excluído com sucesso`);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setDeleteAdminPassword('');
      loadData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Erro ao excluir cliente');
    }
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
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} cadastrados`}
        actions={
          <Button onClick={() => openModal()} iconLeft={<PlusIcon size={16} />}>
            Novo Cliente
          </Button>
        }
      />

      {/* Search */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por responsável, criança, telefone ou email..."
          className="flex-1"
        />
        {searchTerm && (
          <Button variant="outline" onClick={() => { setSearchTerm(''); loadData(); }}>
            Limpar
          </Button>
        )}
      </div>

      {/* List */}
      <Card padding="none">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={28} />}
            title="Nenhum cliente encontrado"
            description={searchTerm ? 'Tente outro termo de busca' : 'Cadastre o primeiro cliente'}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => {
              const custChildren = getCustomerChildren(customer.id);
              return (
                <div key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}>
                        <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-sm">{customer.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>{customer.phone}</span>
                            {customer.email && <><span className="text-slate-300">|</span><span className="truncate">{customer.email}</span></>}
                            {customer.cpf && <><span className="text-slate-300">|</span><span>{customer.cpf}</span></>}
                          </div>
                          {customer.observations && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 truncate max-w-md inline-flex items-center gap-1" title={customer.observations}>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                              {customer.observations}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {(() => {
                          const remaining = getCustomerRemainingHours(customer.id);
                          if (remaining > 0) {
                            const hours = Math.floor(remaining);
                            const mins = Math.round((remaining - hours) * 60);
                            return (
                              <Badge tone="emerald">
                                {hours}h{mins > 0 ? `${mins}m` : ''} restantes
                              </Badge>
                            );
                          }
                          return null;
                        })()}

                        <div className="hidden md:flex items-center gap-1">
                          {custChildren.length === 0 ? (
                            <span className="text-xs text-slate-400">Sem crianças</span>
                          ) : (
                            custChildren.map(ch => (
                              <button
                                key={ch.id}
                                onClick={() => openChildModal(customer.id, ch)}
                                title={ch.enrollmentCode ? `Matrícula: ${ch.enrollmentCode}` : 'Clique para editar'}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full font-semibold text-[11px] px-2 py-0.5',
                                  'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors',
                                )}
                              >
                                {ch.name} ({getChildAge(ch)}a){ch.enrollmentCode ? ` [${ch.enrollmentCode}]` : ''}
                              </button>
                            ))
                          )}
                        </div>

                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => openChildModal(customer.id)}
                          aria-label="Adicionar criança"
                          title="Adicionar criança"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                          </svg>
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(customer)}
                          aria-label="Editar cliente"
                          title="Editar cliente"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </IconButton>
                        {customer.unitId === currentUnit && (
                          <IconButton
                            variant="danger"
                            size="sm"
                            onClick={() => { setDeleteTarget(customer); setDeleteAdminPassword(''); setShowDeleteModal(true); }}
                            aria-label="Excluir cliente"
                            title="Excluir cliente (admin)"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Observations + Package details */}
                  {expandedCustomer === customer.id && (
                    <div className="px-4 pb-4 pt-0 space-y-3">
                      {/* Observations */}
                      {(customer.observations || custChildren.some(ch => ch.observations)) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Observações</p>
                          {customer.observations && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Responsável</p>
                              <p className="text-xs text-amber-900 leading-snug">{customer.observations}</p>
                            </div>
                          )}
                          {custChildren.filter(ch => ch.observations).map(ch => (
                            <div key={ch.id}>
                              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">{ch.name}</p>
                              <p className="text-xs text-amber-900 leading-snug">{ch.observations}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Pacotes Ativos</p>
                        {getCustomerPackages(customer.id).length === 0 ? (
                          <p className="text-xs text-slate-500">Nenhum pacote ativo</p>
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
                                  <p className="text-[10px] text-slate-500 mt-1">{pkg.usedHours.toFixed(1)}h usadas de {pkg.hours}h</p>
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
      </Card>

      {/* Modal Cliente */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-card-lg shadow-card-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-heading text-slate-900">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <IconButton variant="ghost" size="sm" onClick={() => setShowModal(false)} aria-label="Fechar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome Completo *</label>
                <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Telefone *</label>
                  <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">CPF</label>
                  <Input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => { setFormData({ ...formData, cpf: e.target.value }); setCpfError(''); }}
                    invalid={!!cpfError}
                  />
                  {cpfError && <p className="text-[11px] text-red-600 mt-1 font-medium">{cpfError}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Endereço</label>
                  <Input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observações</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Observações sobre o responsável..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:border-slate-300 focus:border-brand-500 focus:outline-none transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit" fullWidth loading={saving}>
                  {editingCustomer ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criança */}
      {showChildModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowChildModal(false); setEditingChild(null); } }}
        >
          <div className="bg-white rounded-card-lg shadow-card-lg max-w-sm w-full" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-heading text-slate-900">{editingChild ? 'Editar Criança' : 'Adicionar Criança'}</h2>
              <IconButton variant="ghost" size="sm" onClick={() => { setShowChildModal(false); setEditingChild(null); }} aria-label="Fechar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
            <form onSubmit={handleChildSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Matrícula Criança</label>
                <Input
                  type="text"
                  value={childFormData.enrollmentCode || ''}
                  onChange={(e) => setChildFormData({ ...childFormData, enrollmentCode: e.target.value.toUpperCase() })}
                  placeholder="Código de matrícula da criança"
                  className="font-mono placeholder:font-sans"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome *</label>
                <Input type="text" value={childFormData.name} onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">CPF</label>
                <Input
                  type="text"
                  value={childFormData.cpf || ''}
                  onChange={(e) => setChildFormData({ ...childFormData, cpf: e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14) })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data de Nascimento *</label>
                <Input type="date" value={childFormData.birthDate} onChange={(e) => setChildFormData({ ...childFormData, birthDate: e.target.value })} required />
                {childFormData.birthDate && (
                  <p className="text-xs text-slate-500 mt-1">Idade: {getChildAge({ age: 0, birthDate: new Date(childFormData.birthDate + 'T00:00:00') })} anos</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observações</label>
                <textarea
                  value={childFormData.observations}
                  onChange={(e) => setChildFormData({ ...childFormData, observations: e.target.value })}
                  placeholder="Observações sobre a criança (alergias, necessidades especiais, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:border-slate-300 focus:border-brand-500 focus:outline-none transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" fullWidth onClick={() => { setShowChildModal(false); setEditingChild(null); }}>Cancelar</Button>
                <Button type="submit" fullWidth loading={saving}>
                  {editingChild ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Excluir Cliente (Admin) */}
      {showDeleteModal && deleteTarget && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeleteTarget(null); setDeleteAdminPassword(''); } }}
        >
          <div className="bg-white rounded-card-lg shadow-card-lg max-w-sm w-full" role="dialog" aria-modal="true">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-heading text-red-700">Excluir Cliente</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-semibold">{deleteTarget.name}</p>
                <p className="text-xs text-red-700 mt-1">{deleteTarget.phone}</p>
                {deleteTarget.cpf && <p className="text-xs text-red-700">CPF: {deleteTarget.cpf}</p>}
              </div>
              <p className="text-sm text-slate-600">Esta ação é irreversível. Digite a senha de administrador para confirmar.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Senha Admin</label>
                <Input
                  type="password"
                  value={deleteAdminPassword}
                  onChange={(e) => setDeleteAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteCustomer()}
                  placeholder="Digite a senha admin"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" fullWidth onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteAdminPassword(''); }}>Cancelar</Button>
                <Button variant="danger" fullWidth onClick={handleDeleteCustomer}>Excluir</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
