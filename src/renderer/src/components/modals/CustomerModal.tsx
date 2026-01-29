import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child } from '../../../../shared/types';
import { customersServiceOffline } from '../../../../shared/firebase/services/customers.service.offline';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer?: Customer | null;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  address: string;
}

interface ChildFormData {
  name: string;
  age: number;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSuccess, customer }) => {
  const [formData, setFormData] = useState<FormData>({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    cpf: customer?.cpf || '',
    address: customer?.address || '',
  });
  const [children, setChildren] = useState<ChildFormData[]>([]);
  const [newChild, setNewChild] = useState<ChildFormData>({ name: '', age: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);

  useEffect(() => {
    if (customer?.id) {
      loadChildren(customer.id);
    }
  }, [customer]);

  const loadChildren = async (customerId: string) => {
    try {
      setLoadingChildren(true);
      const childrenData = await customersServiceOffline.getChildrenByCustomer(customerId);
      setChildren(childrenData.map(c => ({ name: c.name, age: c.age })));
    } catch (error) {
      console.error('Error loading children:', error);
    } finally {
      setLoadingChildren(false);
    }
  };

  const addChild = () => {
    if (!newChild.name || newChild.age <= 0) {
      toast.error('Nome e idade da criança são obrigatórios');
      return;
    }
    setChildren([...children, { ...newChild }]);
    setNewChild({ name: '', age: 0 });
    toast.success('Criança adicionada!');
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
    toast.info('Criança removida');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      console.log('🟢 CustomerModal: Starting save...');
      
      if (customer) {
        console.log('🔄 CustomerModal: Updating customer...');
        await customersServiceOffline.updateCustomer(customer.id, formData);
        console.log('✅ CustomerModal: Update successful');
        toast.success('✅ Cliente atualizado com sucesso!');
      } else {
        console.log('➕ CustomerModal: Creating new customer...');
        const result = await customersServiceOffline.createCustomer(formData);
        console.log('✅ CustomerModal: Create successful, result:', result);
        
        // Cadastrar crianças
        if (children.length > 0) {
          console.log(`👶 Adding ${children.length} children...`);
          for (const child of children) {
            await customersServiceOffline.addChild(result.id, child);
          }
          console.log('✅ Children added successfully');
        }
        
        toast.success(`✅ Cliente cadastrado com ${children.length} criança(s)!`);
      }

      console.log('🔄 CustomerModal: Calling onSuccess...');
      onSuccess();
      console.log('🚪 CustomerModal: Closing modal...');
      handleClose();
      console.log('✅ CustomerModal: Process complete!');
    } catch (error) {
      console.error('❌ CustomerModal: Error saving customer:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      console.log('🏁 CustomerModal: Setting loading to false');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', phone: '', email: '', cpf: '', address: '' });
    setChildren([]);
    setNewChild({ name: '', age: 0 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👥</span>
              <div>
                <h3 className="text-2xl font-bold">
                  {customer ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <p className="text-blue-100 text-sm">
                  {customer ? 'Atualizar informações do cliente' : 'Cadastrar novo cliente no sistema'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
            >
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              👤 Nome Completo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Digite o nome completo"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
              required
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📱 Telefone *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📧 Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🆔 CPF
            </label>
            <input
              type="text"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
            />
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🏠 Endereço
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Endereço completo"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg resize-none"
            />
          </div>

          {/* Seção de Crianças */}
          <div className="border-t-2 border-gray-200 pt-4 mt-4">
            <label className="block text-lg font-bold text-gray-700 mb-3">
              👶 Crianças
            </label>
            
            {/* Lista de crianças adicionadas */}
            {children.length > 0 && (
              <div className="space-y-2 mb-4">
                {children.map((child, index) => (
                  <div key={index} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👶</span>
                      <div>
                        <p className="font-semibold text-gray-800">{child.name}</p>
                        <p className="text-sm text-gray-600">{child.age} anos</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
                      className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário para adicionar criança */}
            {!customer && (
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={newChild.name}
                      onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
                      placeholder="Nome da criança"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={newChild.age || ''}
                      onChange={(e) => setNewChild({ ...newChild, age: parseInt(e.target.value) || 0 })}
                      placeholder="Idade"
                      min="0"
                      max="18"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addChild}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-all font-medium"
                >
                  ➕ Adicionar Criança
                </button>
              </div>
            )}

            {customer && loadingChildren && (
              <p className="text-gray-500 text-center py-2">Carregando crianças...</p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
            >
              {loading ? '⏳ Salvando...' : customer ? '✓ Atualizar Cliente' : '✓ Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
