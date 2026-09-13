import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child, Package } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { useUnit } from '../contexts/UnitContext';
import { getChildAge } from '../../../shared/utils/age';
import {
  Card, Button, IconButton, PageHeader, EmptyState, Skeleton, Input,
} from '../components/ui';
import { PlusIcon, UsersIcon, UserPlusIcon, SearchIcon } from '../components/icons/Icons';

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
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} cadastrados`}
        actions={
          <Button onClick={() => openModal()} iconLeft={<PlusIcon size={16} />}>
            Novo cliente
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
          placeholder="Buscar por responsável, criança, telefone ou e-mail…"
          iconLeft={<SearchIcon size={15} />}
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
          <div className="divide-y divide-line-subtle">
            {filteredCustomers.map((customer) => {
              const custChildren = getCustomerChildren(customer.id);
              return (
                <div key={customer.id} className="hover:bg-paper transition-colors">
                  {/* Saldo de horas é o que o balcão precisa saber ao atender;
                      as crianças entram numa segunda linha para o nome não
                      brigar por espaço quando o responsável tem várias. */}
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
                        aria-expanded={expandedCustomer === customer.id}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:shadow-focus rounded"
                      >
                        <p className="font-semibold text-ink-900 text-sm truncate">{customer.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5 flex-wrap">
                          <span className="tabular-nums">{customer.phone}</span>
                          {customer.email && <><span className="text-ink-300">·</span><span className="truncate">{customer.email}</span></>}
                          {customer.cpf && <><span className="text-ink-300">·</span><span className="tabular-nums">{customer.cpf}</span></>}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(() => {
                          const remaining = getCustomerRemainingHours(customer.id);
                          if (remaining <= 0) return null;
                          const hours = Math.floor(remaining);
                          const mins = Math.round((remaining - hours) * 60);
                          return (
                            <span className="font-mono text-sm font-medium text-money-package tabular-nums">
                              {hours}h{mins > 0 ? String(mins).padStart(2, '0') : ''}
                            </span>
                          );
                        })()}
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => openChildModal(customer.id)}
                          aria-label={`Adicionar criança para ${customer.name}`}
                          title="Adicionar criança"
                        >
                          <UserPlusIcon size={15} />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(customer)}
                          aria-label={`Editar ${customer.name}`}
                          title="Editar responsável"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </IconButton>
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={() => { setDeleteTarget(customer); setDeleteAdminPassword(''); setShowDeleteModal(true); }}
                          aria-label={`Excluir ${customer.name}`}
                          title="Excluir responsável"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />
                          </svg>
                        </IconButton>
                      </div>
                    </div>

                    {custChildren.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {custChildren.map(ch => (
                          <button
                            key={ch.id}
                            onClick={() => openChildModal(customer.id, ch)}
                            title={ch.enrollmentCode ? `Matrícula ${ch.enrollmentCode} — clique para editar` : 'Clique para editar'}
                            className="inline-flex items-center rounded text-[11px] px-1.5 py-0.5 bg-ink-100 text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:shadow-focus"
                          >
                            {ch.name} <span className="text-ink-400 ml-1">{getChildAge(ch)}a</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {customer.observations && (
                      <p className="text-xs text-money-due mt-1.5 truncate" title={customer.observations}>
                        {customer.observations}
                      </p>
                    )}
                  </div>

                  {/* Expanded: Observations + Package details */}
                  {expandedCustomer === customer.id && (
                    <div className="px-4 pb-4 pt-0 space-y-3">
                      {/* Observations */}
                      {(customer.observations || custChildren.some(ch => ch.observations)) && (
                        <div className="bg-state-warn-soft border border-state-warn/30 rounded-lg p-3 space-y-2">
                          <p className="text-[11px] font-bold text-state-warn uppercase tracking-wider">Observações</p>
                          {customer.observations && (
                            <div>
                              <p className="text-[10px] font-semibold text-state-warn uppercase tracking-wider mb-0.5">Responsável</p>
                              <p className="text-xs text-state-warn leading-snug">{customer.observations}</p>
                            </div>
                          )}
                          {custChildren.filter(ch => ch.observations).map(ch => (
                            <div key={ch.id}>
                              <p className="text-[10px] font-semibold text-state-warn uppercase tracking-wider mb-0.5">{ch.name}</p>
                              <p className="text-xs text-state-warn leading-snug">{ch.observations}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-paper rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-ink-600 uppercase tracking-wider">Pacotes Ativos</p>
                        {getCustomerPackages(customer.id).length === 0 ? (
                          <p className="text-xs text-ink-500">Nenhum pacote ativo</p>
                        ) : (
                          <div className="space-y-1.5">
                            {getCustomerPackages(customer.id).map(pkg => {
                              const remaining = Math.max(0, pkg.hours - pkg.usedHours);
                              const remainingH = Math.floor(remaining);
                              const remainingM = Math.round((remaining - remainingH) * 60);
                              const pct = pkg.hours > 0 ? ((pkg.hours - remaining) / pkg.hours) * 100 : 100;
                              return (
                                <div key={pkg.id} className="bg-paper-raised rounded-md p-2.5 border border-line">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-ink-700">{pkg.type}</span>
                                    <span className={`text-[11px] font-bold ${remaining > 0 ? 'text-state-ok' : 'text-state-bad'}`}>
                                      {remainingH}h{remainingM > 0 ? `${remainingM}m` : ''} restantes
                                    </span>
                                  </div>
                                  <div className="mt-1.5 w-full bg-ink-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-state-bad' : pct > 50 ? 'bg-state-warn' : 'bg-state-ok'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                  <p className="text-[10px] text-ink-500 mt-1">{pkg.usedHours.toFixed(1)}h usadas de {pkg.hours}h</p>
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
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between p-5 border-b border-line-subtle">
              <h2 className="text-heading text-ink-900">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <IconButton variant="ghost" size="sm" onClick={() => setShowModal(false)} aria-label="Fechar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Nome Completo *</label>
                <Input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1.5">Telefone *</label>
                  <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1.5">Email</label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1.5">CPF</label>
                  <Input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => { setFormData({ ...formData, cpf: e.target.value }); setCpfError(''); }}
                    invalid={!!cpfError}
                  />
                  {cpfError && <p className="text-[11px] text-state-bad mt-1 font-medium">{cpfError}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1.5">Endereço</label>
                  <Input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Observações</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Observações sobre o responsável..."
                  rows={2}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-paper-raised hover:border-line-strong focus:border-brand-500 focus:outline-none transition-colors resize-none"
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
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-sm w-full" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between p-5 border-b border-line-subtle">
              <h2 className="text-heading text-ink-900">{editingChild ? 'Editar Criança' : 'Adicionar Criança'}</h2>
              <IconButton variant="ghost" size="sm" onClick={() => { setShowChildModal(false); setEditingChild(null); }} aria-label="Fechar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </IconButton>
            </div>
            <form onSubmit={handleChildSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Matrícula Criança</label>
                <Input
                  type="text"
                  value={childFormData.enrollmentCode || ''}
                  onChange={(e) => setChildFormData({ ...childFormData, enrollmentCode: e.target.value.toUpperCase() })}
                  placeholder="Código de matrícula da criança"
                  className="font-mono placeholder:font-sans"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Nome *</label>
                <Input type="text" value={childFormData.name} onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">CPF</label>
                <Input
                  type="text"
                  value={childFormData.cpf || ''}
                  onChange={(e) => setChildFormData({ ...childFormData, cpf: e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14) })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Data de Nascimento *</label>
                <Input type="date" value={childFormData.birthDate} onChange={(e) => setChildFormData({ ...childFormData, birthDate: e.target.value })} required />
                {childFormData.birthDate && (
                  <p className="text-xs text-ink-500 mt-1">Idade: {getChildAge({ age: 0, birthDate: new Date(childFormData.birthDate + 'T00:00:00') })} anos</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Observações</label>
                <textarea
                  value={childFormData.observations}
                  onChange={(e) => setChildFormData({ ...childFormData, observations: e.target.value })}
                  placeholder="Observações sobre a criança (alergias, necessidades especiais, etc.)"
                  rows={2}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-paper-raised hover:border-line-strong focus:border-brand-500 focus:outline-none transition-colors resize-none"
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
          <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-sm w-full" role="dialog" aria-modal="true">
            <div className="p-5 border-b border-line-subtle">
              <h2 className="text-heading text-ink-900">Excluir Cliente</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-state-bad-soft border border-state-bad/30 rounded-lg p-3">
                <p className="text-sm text-state-bad font-semibold">{deleteTarget.name}</p>
                <p className="text-xs text-state-bad mt-1">{deleteTarget.phone}</p>
                {deleteTarget.cpf && <p className="text-xs text-state-bad">CPF: {deleteTarget.cpf}</p>}
              </div>
              <p className="text-sm text-ink-600">Esta ação é irreversível. Digite a senha de administrador para confirmar.</p>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Senha Admin</label>
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
