import React, { useState, useEffect, useRef } from 'react';
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
  const processingRef = useRef(false);
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
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      setLoading(true);
      
      // Verificar se a criança já tem check-in ativo
      const hasActiveCheckIn = await visitsServiceOffline.hasActiveVisit(selectedChild, currentUnit);
      if (hasActiveCheckIn) {
        toast.error('❌ Esta criança já possui um check-in ativo!');
        setLoading(false);
        processingRef.current = false;
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
      processingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInAll = async () => {
    if (customerChildren.length === 0) return;
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      setLoading(true);
      let success = 0;
      let skipped = 0;

      for (const child of customerChildren) {
        const hasActive = await visitsServiceOffline.hasActiveVisit(child.id, currentUnit);
        if (hasActive) {
          skipped++;
          continue;
        }
        await visitsServiceOffline.checkIn({ childId: child.id, unitId: currentUnit });
        success++;
      }

      if (success > 0) {
        toast.success(`✅ Check-in realizado para ${success} criança(s)!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} criança(s) já tinham check-in ativo`);
      }

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error during check-in all:', error);
      toast.error('Erro ao realizar check-in');
      processingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomer('');
    setSelectedChild('');
    setSearchTerm('');
    processingRef.current = false;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Novo Check-In</h2>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">Criança</label>
                {customerChildren.length > 1 && (
                  <button type="button" onClick={handleCheckInAll} disabled={loading}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50 transition-colors">
                    Check-in em Todos ({customerChildren.length})
                  </button>
                )}
              </div>
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

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!selectedChild || loading} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? '⏳ Processando...' : 'Confirmar Check-In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckInModal;
