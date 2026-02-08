import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Package, Child, Customer } from '../../../shared/types';
import { format } from 'date-fns';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import PackagePaymentModal from '../components/modals/PackagePaymentModal';

interface PackageFormData {
  customerId: string;
  childId: string;
  type: string;
  hours: number;
  price: number;
  expiryDays?: number;
}

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  
  // Estado para modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPackageData, setPendingPackageData] = useState<PackageFormData | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState<PackageFormData>({
    customerId: '',
    childId: '',
    type: 'Pacote 10h',
    hours: 10,
    price: 300,
    expiryDays: 30,
  });

  useEffect(() => {
    loadData();
  }, [showActiveOnly]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPackages, allCustomers, allChildren] = await Promise.all([
        showActiveOnly ? packagesServiceOffline.getActivePackages() : packagesServiceOffline.getActivePackages(),
        customersServiceOffline.getAllCustomers(),
        customersServiceOffline.getAllChildren(),
      ]);
      setPackages(allPackages);
      setCustomers(allCustomers);
      setChildren(allChildren);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        customerId: pkg.customerId,
        childId: pkg.childId,
        type: pkg.type,
        hours: pkg.hours,
        price: pkg.price,
        expiryDays: pkg.expiryDays || 30,
      });
    } else {
      setEditingPackage(null);
      setFormData({
        customerId: '',
        childId: '',
        type: 'Pacote 10h',
        hours: 10,
        price: 300,
        expiryDays: 30,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.childId) {
      toast.error('Selecione cliente e criança');
      return;
    }

    try {
      if (editingPackage) {
        // Edição de pacote existente - não precisa de pagamento
        await packagesServiceOffline.updatePackage(editingPackage.id, formData);
        toast.success('✅ Pacote atualizado com sucesso!');
        setShowModal(false);
        loadData();
      } else {
        // NOVO PACOTE - Abre modal de pagamento obrigatório
        const child = children.find(c => c.id === formData.childId);
        const customer = customers.find(c => c.id === formData.customerId);
        
        if (!child || !customer) {
          toast.error('Erro ao carregar dados do cliente');
          return;
        }
        
        setSelectedChild(child);
        setSelectedCustomer(customer);
        setPendingPackageData(formData);
        setShowModal(false);
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Erro ao salvar pacote');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPendingPackageData(null);
    setSelectedChild(null);
    setSelectedCustomer(null);
    loadData();
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await packagesServiceOffline.updatePackage(id, { active: !currentStatus });
      toast.success(`Pacote ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      loadData();
    } catch (error) {
      console.error('Error toggling package:', error);
      toast.error('Erro ao atualizar pacote');
    }
  };

  const getPackageProgress = (pkg: Package) => {
    return Math.min((pkg.usedHours / pkg.hours) * 100, 100);
  };

  const getExpirationDate = (pkg: Package): Date | null => {
    if (pkg.expiresAt) {
      return pkg.expiresAt instanceof Date ? pkg.expiresAt : new Date(pkg.expiresAt);
    }
    if (pkg.expiryDays) {
      const createdDate = pkg.createdAt instanceof Date ? pkg.createdAt : new Date(pkg.createdAt);
      const expiryDate = new Date(createdDate);
      expiryDate.setDate(expiryDate.getDate() + pkg.expiryDays);
      return expiryDate;
    }
    return null;
  };

  const getRemainingHours = (pkg: Package) => {
    return Math.max(pkg.hours - pkg.usedHours, 0);
  };

  const getChildName = (childId: string) => {
    const child = children.find(c => c.id === childId);
    return child?.name || 'Criança não encontrada';
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Cliente não encontrado';
  };

  const getCustomerChildren = (customerId: string) => {
    return children.filter(c => c.customerId === customerId);
  };

  const packageTypes = [
    { name: 'Pacote 5h', hours: 5, price: 150 },
    { name: 'Pacote 10h', hours: 10, price: 300 },
    { name: 'Pacote 20h', hours: 20, price: 550 },
    { name: 'Pacote 30h', hours: 30, price: 800 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Pacotes</h1>
          <p className="text-gray-500">Gerenciar pacotes de horas - {packages.length} cadastrados</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
        >
          <span>📦</span> Novo Pacote
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-5 h-5 text-purple-500 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-700">Mostrar apenas pacotes ativos</span>
          </label>
          <button
            onClick={loadData}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄'} Atualizar
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-6 border border-gray-200 rounded-xl">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-6xl mb-4">📦</p>
            <p className="text-xl font-medium">Nenhum pacote encontrado</p>
            <p className="text-sm mt-2">Crie o primeiro pacote de horas!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const progress = getPackageProgress(pkg);
              const remaining = getRemainingHours(pkg);
              const expirationDate = getExpirationDate(pkg);
              const isExpired = expirationDate && expirationDate < new Date();
              
              return (
                <div
                  key={pkg.id}
                  className={`border-2 rounded-xl p-6 hover:shadow-lg transition-all ${
                    pkg.active ? 'border-purple-200' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-800">{pkg.type}</h3>
                      <p className="text-sm text-gray-500">{getChildName(pkg.childId)}</p>
                      <p className="text-xs text-gray-400">{getCustomerName(pkg.customerId)}</p>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        pkg.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {pkg.active ? '✓ Ativo' : '✗ Inativo'}
                    </span>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Valor</span>
                      <span className="text-2xl font-bold text-purple-600">
                        R$ {pkg.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Horas utilizadas</span>
                      <span className="font-bold text-gray-800">
                        {pkg.usedHours.toFixed(1)}h / {pkg.hours}h
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-yellow-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2">
                      {remaining > 0 ? `⏱️ Restam ${remaining.toFixed(1)} horas` : '⚠️ Pacote esgotado'}
                    </p>
                  </div>

                  {expirationDate && (
                    <div className={`text-sm mb-4 p-2 rounded ${isExpired ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      {isExpired ? '⚠️ Expirado em: ' : '📅 Expira em: '}
                      {format(expirationDate, 'dd/MM/yyyy')}
                      {pkg.expiryDays && (
                        <span className="text-xs ml-2">({pkg.expiryDays} dias)</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(pkg)}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(pkg.id, pkg.active)}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        pkg.active
                          ? 'bg-gray-500 text-white hover:bg-gray-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {pkg.active ? '✗ Desativar' : '✓ Ativar'}
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
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold">
                {editingPackage ? '✏️ Editar Pacote' : '📦 Novo Pacote'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <select
                  value={formData.customerId}
                  onChange={(e) => {
                    setFormData({ ...formData, customerId: e.target.value, childId: '' });
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="">Selecione um cliente...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.customerId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criança *
                  </label>
                  <select
                    value={formData.childId}
                    onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="">Selecione uma criança...</option>
                    {getCustomerChildren(formData.customerId).map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name} ({child.age} anos)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Pacote *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {packageTypes.map((type) => (
                    <button
                      key={type.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.name, hours: type.hours, price: type.price })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.type === type.name
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <div className="font-bold text-lg">{type.name}</div>
                      <div className="text-sm text-gray-600">{type.hours} horas</div>
                      <div className="text-purple-600 font-bold">R$ {type.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horas *
                  </label>
                  <input
                    type="number"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    min="1"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Validade do Pacote (dias)
                </label>
                <select
                  value={formData.expiryDays || 30}
                  onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="15">15 dias</option>
                  <option value="30">30 dias (1 mês)</option>
                  <option value="60">60 dias (2 meses)</option>
                  <option value="90">90 dias (3 meses)</option>
                  <option value="120">120 dias (4 meses)</option>
                  <option value="180">180 dias (6 meses)</option>
                  <option value="365">365 dias (1 ano)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  O pacote expirará {formData.expiryDays || 30} dias após a criação
                </p>
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
                  className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  {editingPackage ? 'Atualizar' : 'Criar Pacote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Pagamento Obrigatório */}
      {showPaymentModal && pendingPackageData && selectedChild && selectedCustomer && (
        <PackagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPendingPackageData(null);
            setSelectedChild(null);
            setSelectedCustomer(null);
          }}
          onSuccess={handlePaymentSuccess}
          packageData={pendingPackageData}
          child={selectedChild}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
};

export default Packages;
