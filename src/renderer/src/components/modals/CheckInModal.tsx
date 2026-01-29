import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child } from '../../../../shared/types';
import { customersService } from '../../../../shared/firebase/services/customers.service';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { useUnit } from '../../contexts/UnitContext';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckInModal: React.FC<CheckInModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUnit } = useUnit();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    try {
      const [allCustomers, allChildren] = await Promise.all([
        customersService.getAllCustomers(),
        customersService.getAllChildren(),
      ]);
      setCustomers(allCustomers);
      setChildren(allChildren);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const customerChildren = children.filter(c => c.customerId === selectedCustomer);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChild) {
      toast.error('Selecione uma criança');
      return;
    }

    try {
      setLoading(true);
      
      // Verificar se a criança já tem check-in ativo
      const hasActiveCheckIn = await visitsServiceOffline.hasActiveVisit(selectedChild, currentUnit);
      if (hasActiveCheckIn) {
        toast.error('❌ Esta criança já possui um check-in ativo!');
        setLoading(false);
        return;
      }

      await visitsServiceOffline.checkIn({
        childId: selectedChild,
        unitId: currentUnit,
      });

      toast.success('✅ Check-in realizado com sucesso!');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Erro ao realizar check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomer('');
    setSelectedChild('');
    setSearchTerm('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">➕</span>
              <div>
                <h3 className="text-2xl font-bold">Novo Check-In</h3>
                <p className="text-green-100 text-sm">Registrar entrada de criança</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Busca de Cliente */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🔍 Buscar Cliente
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite nome ou telefone..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-green-500 text-lg"
            />
          </div>

          {/* Lista de Clientes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              👤 Selecione o Cliente
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-2">
              {filteredCustomers.length === 0 ? (
                <p className="text-center text-gray-400 py-4">Nenhum cliente encontrado</p>
              ) : (
                filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(customer.id);
                      setSelectedChild('');
                    }}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedCustomer === customer.id
                        ? 'bg-green-100 border-2 border-green-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <p className="font-bold text-gray-800">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.phone}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Lista de Crianças */}
          {selectedCustomer && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                👶 Selecione a Criança
              </label>
              <div className="space-y-2">
                {customerChildren.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 bg-gray-50 rounded-lg">
                    Este cliente não tem crianças cadastradas
                  </p>
                ) : (
                  customerChildren.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedChild(child.id)}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedChild === child.id
                          ? 'bg-green-100 border-2 border-green-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <p className="font-bold text-gray-800">{child.name}</p>
                      <p className="text-sm text-gray-600">{child.age} anos</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

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
              disabled={!selectedChild || loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
            >
              {loading ? '⏳ Processando...' : '✓ Confirmar Check-In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckInModal;
