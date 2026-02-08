import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Child, Customer } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';

interface PackageOption {
  name: string;
  hours: number;
  price: number;
  expiryDays: number;
}

const PACKAGE_OPTIONS: PackageOption[] = [
  { name: 'Pacote 5h', hours: 5, price: 150, expiryDays: 30 },
  { name: 'Pacote 10h', hours: 10, price: 300, expiryDays: 30 },
  { name: 'Pacote 20h', hours: 20, price: 550, expiryDays: 60 },
  { name: 'Pacote 30h', hours: 30, price: 800, expiryDays: 90 },
];

const SellPackage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filteredChildren, setFilteredChildren] = useState<Child[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredChildren(children);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = children.filter(child => {
        const customer = customers.find(c => c.id === child.customerId);
        const childName = child.name.toLowerCase();
        const customerName = customer?.name.toLowerCase() || '';
        return childName.includes(term) || customerName.includes(term);
      });
      setFilteredChildren(filtered);
    }
  }, [searchTerm, children, customers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allCustomers, allChildren] = await Promise.all([
        customersServiceOffline.getAllCustomers(),
        customersServiceOffline.getAllChildren(),
      ]);
      setCustomers(allCustomers);
      setChildren(allChildren);
      setFilteredChildren(allChildren);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPackage = (pkg: PackageOption) => {
    if (!selectedChildId) {
      toast.warning('Selecione uma criança primeiro');
      return;
    }

    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPackage(null);
    setSelectedCustomerId('');
    setSelectedChildId('');
    setSearchTerm('');
    toast.success('🎉 Pacote vendido com sucesso!');
  };

  const selectedChild = children.find(c => c.id === selectedChildId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🛒 Vender Pacote</h1>
          <p className="text-gray-500">Selecione a criança e o pacote para realizar a venda</p>
        </div>
      </div>

      {/* Seleção de Cliente/Criança */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">1️⃣ Selecione o Cliente e a Criança</h2>
        
        {/* Busca */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            🔍 Buscar Criança ou Responsável
          </label>
          <input
            type="text"
            placeholder="Digite o nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
          />
        </div>

        {/* Seletor de Criança */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            👶 Criança
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => {
              setSelectedChildId(e.target.value);
              const child = children.find(c => c.id === e.target.value);
              if (child) {
                setSelectedCustomerId(child.customerId);
              }
            }}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 text-lg"
          >
            <option value="">Selecione uma criança...</option>
            {filteredChildren.map((child) => {
              const customer = customers.find(c => c.id === child.customerId);
              return (
                <option key={child.id} value={child.id}>
                  {child.name} ({child.age} anos) - Responsável: {customer?.name || 'N/A'}
                </option>
              );
            })}
          </select>
        </div>

        {selectedChild && selectedCustomer && (
          <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
            <p className="text-sm text-green-800">
              <span className="font-bold">✅ Selecionado:</span> {selectedChild.name} - Responsável: {selectedCustomer.name}
            </p>
          </div>
        )}
      </div>

      {/* Seleção de Pacote */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">2️⃣ Escolha o Pacote</h2>
        
        {!selectedChildId ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">👆</p>
            <p>Selecione uma criança primeiro</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACKAGE_OPTIONS.map((pkg) => (
              <button
                key={pkg.name}
                onClick={() => handleSelectPackage(pkg)}
                className="border-2 border-purple-200 rounded-xl p-6 hover:border-purple-500 hover:shadow-lg transition-all bg-gradient-to-br from-purple-50 to-white"
              >
                <div className="text-center">
                  <div className="text-4xl mb-3">📦</div>
                  <h3 className="font-bold text-xl text-gray-800 mb-2">{pkg.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    <p>⏱️ {pkg.hours} horas</p>
                    <p>📅 Válido por {pkg.expiryDays} dias</p>
                  </div>
                  <div className="text-3xl font-bold text-purple-600">
                    R$ {pkg.price.toFixed(2)}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    R$ {(pkg.price / pkg.hours).toFixed(2)}/hora
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-800 mb-2">ℹ️ Informações Importantes</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• O pagamento deve ser processado imediatamente após a seleção do pacote</li>
          <li>• O pacote só será ativado após a confirmação do pagamento</li>
          <li>• A validade do pacote começa a contar a partir da data de compra</li>
          <li>• Para editar ou desativar pacotes, acesse a área administrativa (Gestão de Pacotes)</li>
        </ul>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedPackage && selectedChild && selectedCustomer && (
        <PackagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPackage(null);
          }}
          onSuccess={handlePaymentSuccess}
          packageData={{
            customerId: selectedCustomer.id,
            childId: selectedChild.id,
            type: selectedPackage.name,
            hours: selectedPackage.hours,
            price: selectedPackage.price,
            expiryDays: selectedPackage.expiryDays,
          }}
          child={selectedChild}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
};

export default SellPackage;
