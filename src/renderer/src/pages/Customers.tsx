import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  address: string;
}

interface ChildFormData {
  name: string;
  age: number;
  customerId: string;
}

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    address: '',
  });

  const [childFormData, setChildFormData] = useState<ChildFormData>({
    name: '',
    age: 0,
    customerId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allCustomers, allChildren] = await Promise.all([
        customersServiceOffline.getAllCustomers(),
        customersServiceOffline.getAllChildren(),
      ]);
      setCustomers(allCustomers);
      setChildren(allChildren);
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
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    try {
      if (editingCustomer) {
        await customersServiceOffline.updateCustomer(editingCustomer.id, formData);
        toast.success('✅ Cliente atualizado com sucesso!');
      } else {
        await customersServiceOffline.createCustomer(formData);
        toast.success('✅ Cliente cadastrado com sucesso!');
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Erro ao salvar cliente');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o cliente ${name}?`)) {
      return;
    }

    try {
      await customersServiceOffline.deleteCustomer(id);
      toast.success('✅ Cliente excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Erro ao excluir cliente');
    }
  };

  const openChildModal = (customerId: string) => {
    setChildFormData({ name: '', age: 0, customerId });
    setShowChildModal(true);
  };

  const handleChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!childFormData.name || childFormData.age <= 0) {
      toast.error('Nome e idade são obrigatórios');
      return;
    }

    try {
      await customersServiceOffline.addChild(childFormData.customerId, {
        name: childFormData.name,
        age: childFormData.age,
      });
      toast.success('✅ Criança cadastrada com sucesso!');
      setChildFormData({ name: '', age: 0, customerId: '' });
      setShowChildModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding child:', error);
      toast.error('Erro ao cadastrar criança');
    }
  };

  const getCustomerChildren = (customerId: string) => {
    return children.filter(c => c.customerId === customerId);
  };

  const filteredCustomers = searchTerm
    ? customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
      )
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
          placeholder="Buscar por nome, telefone ou email..."
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
                <div key={customer.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
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
                      {/* Children badges */}
                      <div className="hidden md:flex items-center gap-1">
                        {custChildren.length === 0 ? (
                          <span className="text-xs text-slate-400">Sem crianças</span>
                        ) : (
                          custChildren.map(ch => (
                            <span key={ch.id} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {ch.name} ({ch.age}a)
                            </span>
                          ))
                        )}
                      </div>

                      <button onClick={() => openChildModal(customer.id)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm" title="Adicionar criança">👶+</button>
                      <button onClick={() => openModal(customer)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors text-sm" title="Editar">✏️</button>
                      <button onClick={() => handleDelete(customer.id, customer.name)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors text-sm" title="Excluir">🗑️</button>
                    </div>
                  </div>
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
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors">{editingCustomer ? 'Salvar' : 'Cadastrar'}</button>
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
              <h2 className="text-lg font-bold text-slate-800">Adicionar Criança</h2>
              <button onClick={() => setShowChildModal(false)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <form onSubmit={handleChildSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome *</label>
                <input type="text" value={childFormData.name} onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Idade *</label>
                <input type="number" value={childFormData.age || ''} onChange={(e) => setChildFormData({ ...childFormData, age: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" min="0" max="18" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowChildModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
