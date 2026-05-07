import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Customer } from '../../../shared/types';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, PageHeader, EmptyState, Input, Badge, cn,
} from '../components/ui';
import { PackageIcon, ShoppingCartIcon } from '../components/icons/Icons';

interface PackageOption {
  name: string;
  hours: number;
  price: number;
  expiryDays: number;
}

const SellPackage: React.FC = () => {
  const { currentUnit } = useUnit();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUnit]);

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
        customersServiceOffline.getAllCustomers(currentUnit),
        settingsServiceOffline.getPackagePlans(currentUnit),
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
      <PageHeader
        title="Vender Pacote"
        subtitle="Selecione o responsável e o pacote para realizar a venda"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-5">
          <Card padding="md" accent>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white text-sm font-bold flex items-center justify-center shadow-brand-sm">1</span>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Responsável</h2>
            </div>
            <Input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-3"
            />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
            >
              <option value="">Selecione...</option>
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.phone ? ` - ${customer.phone}` : ''}
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-3 p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-semibold text-emerald-800">{selectedCustomer.name}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Pacote será vinculado a este responsável
                </p>
              </div>
            )}
          </Card>

          <Card padding="md" className="bg-slate-50/60">
            <h3 className="font-semibold text-sm text-slate-800 mb-2">Informações</h3>
            <ul className="text-xs text-slate-600 space-y-1.5">
              <li className="flex gap-1.5"><span className="text-brand-500">•</span>Pacote pertence ao responsável</li>
              <li className="flex gap-1.5"><span className="text-brand-500">•</span>Pode ser usado por qualquer criança dele</li>
              <li className="flex gap-1.5"><span className="text-brand-500">•</span>Ativado após confirmação do pagamento</li>
              <li className="flex gap-1.5"><span className="text-brand-500">•</span>Validade conta a partir da compra</li>
            </ul>
          </Card>
        </div>

        {/* Right - Pacotes */}
        <div className="lg:col-span-2">
          <Card padding="md" accent>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white text-sm font-bold flex items-center justify-center shadow-brand-sm">2</span>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Escolha o Pacote</h2>
            </div>

            {!selectedCustomerId ? (
              <EmptyState
                icon={<ShoppingCartIcon size={28} />}
                title="Selecione um responsável primeiro"
                description="Use o painel ao lado para escolher quem receberá o pacote"
              />
            ) : packageOptions.length === 0 ? (
              <EmptyState
                icon={<PackageIcon size={28} />}
                title="Nenhum plano configurado"
                description="Configure os planos na Gestão de Pacotes"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packageOptions.map((pkg) => (
                  <button
                    key={pkg.name}
                    onClick={() => handleSelectPackage(pkg)}
                    className={cn(
                      'group text-left border border-slate-200 rounded-card-lg p-5 transition-all duration-200',
                      'bg-gradient-to-br from-white to-brand-50/30',
                      'hover:border-brand-400 hover:shadow-card-hover hover:-translate-y-0.5',
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{pkg.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{pkg.hours}h &middot; {pkg.expiryDays} dias</p>
                      </div>
                      <div className="w-9 h-9 bg-brand-gradient rounded-lg flex items-center justify-center text-white shadow-brand-sm group-hover:scale-110 transition-transform">
                        <PackageIcon size={18} />
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold bg-brand-gradient bg-clip-text text-transparent tabular-nums">R$ {pkg.price.toFixed(2)}</p>
                        <p className="text-[11px] text-slate-500">R$ {(pkg.price / pkg.hours).toFixed(2)}/hora</p>
                      </div>
                      <Badge tone="brand">Selecionar</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

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
