import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child } from '../../../../shared/types';
import { customersService } from '../../../../shared/firebase/services/customers.service';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PackageModal: React.FC<PackageModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hours, setHours] = useState<number>(10);
  const [price, setPrice] = useState<number>(0);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [sharedAcrossUnits, setSharedAcrossUnits] = useState<boolean>(true);
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

    if (hours <= 0) {
      toast.error('Quantidade de horas deve ser maior que zero');
      return;
    }

    if (price <= 0) {
      toast.error('Preço deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      await packagesServiceOffline.createPackage({
        customerId: selectedCustomer,
        childId: selectedChild,
        type: 'hours',
        hours,
        usedHours: 0,
        price,
        expiresAt,
        active: true,
        sharedAcrossUnits,
      });

      toast.success('✅ Pacote criado com sucesso!');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating package:', error);
      toast.error('Erro ao criar pacote');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomer('');
    setSelectedChild('');
    setSearchTerm('');
    setHours(10);
    setPrice(0);
    setExpiresInDays(30);
    setSharedAcrossUnits(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📦</span>
              <div>
                <h3 className="text-2xl font-bold">Novo Pacote de Horas</h3>
                <p className="text-purple-100 text-sm">Criar pacote para cliente</p>
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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
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
                        ? 'bg-purple-100 border-2 border-purple-500'
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
                          ? 'bg-purple-100 border-2 border-purple-500'
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

          {/* Configurações do Pacote */}
          {selectedChild && (
            <div className="space-y-4 bg-purple-50 p-4 rounded-xl">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <span>⚙️</span> Configurações do Pacote
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏱️ Horas
                  </label>
                  <input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    💰 Preço (R$)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📅 Validade (dias)
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
                />
              </div>

              <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="sharedUnits"
                  checked={sharedAcrossUnits}
                  onChange={(e) => setSharedAcrossUnits(e.target.checked)}
                  className="w-5 h-5 text-purple-600"
                />
                <label htmlFor="sharedUnits" className="text-sm font-medium text-gray-700 cursor-pointer">
                  🔄 Permitir uso em todas as unidades
                </label>
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
              className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
            >
              {loading ? '⏳ Criando...' : '✓ Criar Pacote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackageModal;
