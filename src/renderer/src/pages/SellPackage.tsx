import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';

interface PackageOption {
  name: string;
  hours: number;
  price: number;
  expiryDays: number;
}

const SellPackage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = customers.filter(c => c.name.toLowerCase().includes(term));
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  const loadData = async () => {
    try {
      const [allCustomers, plans] = await Promise.all([
        customersServiceOffline.getAllCustomers(),
        settingsServiceOffline.getPackagePlans(),
      ]);
      setCustomers(allCustomers);
      setFilteredCustomers(allCustomers);
      setPackageOptions(plans);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const handleSelectPackage = (pkg: PackageOption) => {
    if (!selectedCustomerId) {
      toast.warning('Selecione um responsável primeiro');
      return;
    }
    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPackage(null);
    setSelectedCustomerId('');
    setSearchTerm('');
    toast.success('Pacote vendido com sucesso!');
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Vender Pacote</h1>
        <p className="text-sm text-slate-500">Selecione o responsável e o pacote para realizar a venda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Seleção */}
        <div className="space-y-5">
          {/* Busca e Seleção de Responsável */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">1. Responsável</h2>
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm mb-3"
            />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            >
              <option value="">Selecione...</option>
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {customer.phone ? `- ${customer.phone}` : ''}
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-semibold text-emerald-800">{selectedCustomer.name}</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Pacote será vinculado a este responsável
                </p>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-700 mb-2">Informações</h3>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>- Pacote pertence ao responsável</li>
              <li>- Pode ser usado por qualquer criança dele</li>
              <li>- Ativado após confirmação do pagamento</li>
              <li>- Validade conta a partir da compra</li>
            </ul>
          </div>
        </div>

        {/* Right - Pacotes */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4">2. Escolha o Pacote</h2>

            {!selectedCustomerId ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-2">�</p>
                <p className="text-sm">Selecione um responsável primeiro</p>
              </div>
            ) : packageOptions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-2">📦</p>
                <p className="text-sm">Nenhum plano configurado</p>
                <p className="text-xs mt-1">Configure os planos na Gestão de Pacotes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageOptions.map((pkg) => (
                  <button
                    key={pkg.name}
                    onClick={() => handleSelectPackage(pkg)}
                    className="text-left border border-slate-200 rounded-xl p-5 hover:border-violet-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors">{pkg.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{pkg.hours}h &middot; {pkg.expiryDays} dias</p>
                      </div>
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                        <span className="text-sm">📦</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-violet-600">R$ {pkg.price.toFixed(2)}</p>
                        <p className="text-[11px] text-slate-400">R$ {(pkg.price / pkg.hours).toFixed(2)}/hora</p>
                      </div>
                      <span className="text-xs font-medium text-violet-500 bg-violet-50 px-2 py-1 rounded">Selecionar</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedPackage && selectedCustomer && (
        <PackagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPackage(null);
          }}
          onSuccess={handlePaymentSuccess}
          packageData={{
            customerId: selectedCustomer.id,
            type: selectedPackage.name,
            hours: selectedPackage.hours,
            price: selectedPackage.price,
            expiryDays: selectedPackage.expiryDays,
          }}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
};

export default SellPackage;
