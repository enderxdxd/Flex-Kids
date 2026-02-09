import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Customer, Child } from '../../../../shared/types';
import { customersService } from '../../../../shared/firebase/services/customers.service';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';
import { useUnit } from '../../contexts/UnitContext';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PackageModal: React.FC<PackageModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUnit } = useUnit();
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
        childId: selectedChild || undefined,
        type: 'hours',
        hours,
        usedHours: 0,
        price,
        expiresAt,
        active: true,
        sharedAcrossUnits,
        unitId: currentUnit,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Novo Pacote de Horas</h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Buscar Cliente</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nome ou telefone..." className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {/* Customer List */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cliente</label>
            <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-1.5">
              {filteredCustomers.length === 0 ? (
                <p className="text-center text-slate-400 py-3 text-xs">Nenhum cliente encontrado</p>
              ) : (
                filteredCustomers.map(customer => (
                  <button key={customer.id} type="button" onClick={() => { setSelectedCustomer(customer.id); setSelectedChild(''); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${selectedCustomer === customer.id ? 'bg-violet-50 border border-violet-300' : 'hover:bg-slate-50 border border-transparent'}`}>
                    <p className="font-semibold text-slate-800">{customer.name}</p>
                    <p className="text-xs text-slate-500">{customer.phone}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Children */}
          {selectedCustomer && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Criança</label>
              <div className="space-y-1">
                {customerChildren.length === 0 ? (
                  <p className="text-center text-slate-400 py-3 text-xs bg-slate-50 rounded-lg">Sem crianças cadastradas</p>
                ) : (
                  customerChildren.map(child => (
                    <button key={child.id} type="button" onClick={() => setSelectedChild(child.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${selectedChild === child.id ? 'bg-emerald-50 border border-emerald-300' : 'hover:bg-slate-50 border border-transparent'}`}>
                      <p className="font-semibold text-slate-800">{child.name}</p>
                      <p className="text-xs text-slate-500">{child.age} anos</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Package Config */}
          {selectedChild && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Configurações</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Horas</label>
                  <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Preço (R$)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min="0" step="0.01" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Validade (dias)</label>
                  <input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} min="1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="sharedUnits" checked={sharedAcrossUnits} onChange={(e) => setSharedAcrossUnits(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
                <span className="text-sm text-slate-600">Uso em todas as unidades</span>
              </label>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!selectedChild || loading} className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? '⏳ Criando...' : 'Criar Pacote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackageModal;
