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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Clientes</h1>
          <p className="text-gray-500">Gerenciar clientes e crianças - {customers.length} cadastrados</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
        >
          <span>➕</span> Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="🔍 Buscar por nome, telefone ou email..."
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Buscar
          </button>
          <button
            onClick={loadData}
            className="bg-gray-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Limpar
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-6 border border-gray-200 rounded-xl">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-6xl mb-4">👥</p>
            <p className="text-xl font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-2">Cadastre o primeiro cliente para começar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => {
              const customerChildren = getCustomerChildren(customer.id);
              return (
                <div
                  key={customer.id}
                  className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{customer.name}</h3>
                        <p className="text-sm text-gray-500">📞 {customer.phone}</p>
                      </div>
                    </div>
                  </div>

                  {customer.email && (
                    <p className="text-sm text-gray-600 mb-2">✉️ {customer.email}</p>
                  )}
                  {customer.cpf && (
                    <p className="text-sm text-gray-600 mb-2">🆔 {customer.cpf}</p>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Crianças:</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">
                        {customerChildren.length}
                      </span>
                    </div>
                    {customerChildren.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {customerChildren.map(child => (
                          <div key={child.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            👶 {child.name} ({child.age} anos)
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => openChildModal(customer.id)}
                      className="text-blue-600 text-sm font-medium hover:text-blue-800"
                    >
                      + Adicionar Criança
                    </button>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openModal(customer)}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id, customer.name)}
                      className="flex-1 bg-red-500 text-white py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">
                {editingCustomer ? '✏️ Editar Cliente' : '➕ Novo Cliente'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CPF
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  {editingCustomer ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChildModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">👶 Adicionar Criança</h2>
            </div>
            <form onSubmit={handleChildSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Criança *
                </label>
                <input
                  type="text"
                  value={childFormData.name}
                  onChange={(e) => setChildFormData({ ...childFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idade *
                </label>
                <input
                  type="number"
                  value={childFormData.age || ''}
                  onChange={(e) => setChildFormData({ ...childFormData, age: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  min="0"
                  max="18"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowChildModal(false)}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
