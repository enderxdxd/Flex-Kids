import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Customer } from '../../../../shared/types';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">{customer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome Completo *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefone *</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 00000-0000" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">CPF</label>
              <input type="text" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Endereço</label>
              <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Endereço" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          {/* Children */}
          <div className="border-t border-slate-200 pt-3 mt-1">
            <p className="text-xs font-semibold text-slate-600 mb-2">Crianças</p>

            {children.length > 0 && (
              <div className="space-y-1 mb-3">
                {children.map((child, index) => (
                  <div key={index} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{child.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{child.age} anos</span>
                    </div>
                    <button type="button" onClick={() => removeChild(index)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                ))}
              </div>
            )}

            {!customer && (
              <div className="flex gap-2">
                <input type="text" value={newChild.name} onChange={(e) => setNewChild({ ...newChild, name: e.target.value })} placeholder="Nome" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <input type="number" value={newChild.age || ''} onChange={(e) => setNewChild({ ...newChild, age: parseInt(e.target.value) || 0 })} placeholder="Idade" min="0" max="18" className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <button type="button" onClick={addChild} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">+ Add</button>
              </div>
            )}

            {customer && loadingChildren && (
              <p className="text-xs text-slate-400 text-center py-2">Carregando crianças...</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? '⏳ Salvando...' : customer ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
