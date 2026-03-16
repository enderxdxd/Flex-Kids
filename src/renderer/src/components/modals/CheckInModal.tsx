import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
import { toast } from 'react-toastify';
import { Customer, Child, KidsPlan } from '../../../../shared/types';
import { customersServiceOffline } from '../../../../shared/firebase/services/customers.service.offline';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { kidsPlansServiceOffline } from '../../../../shared/firebase/services/kidsPlans.service.offline';
import { useUnit } from '../../contexts/UnitContext';
import { getChildAge } from '../../../../shared/utils/age';

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
  const [searchMode, setSearchMode] = useState<'client' | 'child'>('client');
  const [kidsPlans, setKidsPlans] = useState<KidsPlan[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    try {
      const [allCustomers, allChildren, activePlans] = await Promise.all([
        customersServiceOffline.getAllCustomers(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        kidsPlansServiceOffline.getActivePlans(currentUnit),
      ]);
      setCustomers(allCustomers);
      setChildren(allChildren);
      setKidsPlans(activePlans);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const getChildPlan = (childId: string): KidsPlan | undefined => {
    // 1. Match by childId
    const byId = kidsPlans.find(p => p.childId === childId && (p.status === 'active' || p.status === 'expiring'));
    if (byId) return byId;
    // 2. Fallback: match by enrollmentCode
    const child = children.find(c => c.id === childId);
    if (child?.enrollmentCode) {
      return kidsPlans.find(p => p.enrollmentCode === child.enrollmentCode && (p.status === 'active' || p.status === 'expiring'));
    }
    return undefined;
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const customerChildren = children.filter(c => c.customerId === selectedCustomer);

  const filteredChildrenByName = searchTerm.trim().length > 0
    ? children.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

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

      const plan = getChildPlan(selectedChild);
      await visitsServiceOffline.checkIn({
        childId: selectedChild,
        unitId: currentUnit,
        kidsPlanId: plan?.id,
      });

      toast.success(plan ? '✅ Check-in realizado (Plano Kids)!' : '✅ Check-in realizado com sucesso!');
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
        const plan = getChildPlan(child.id);
        await visitsServiceOffline.checkIn({ childId: child.id, unitId: currentUnit, kidsPlanId: plan?.id });
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
    setSearchMode('client');
    processingRef.current = false;
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-end p-4 border-b border-slate-200/50">
          <button onClick={handleClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 p-1 shadow-inner">
            <button type="button" onClick={() => { setSearchMode('client'); setSearchTerm(''); setSelectedCustomer(''); setSelectedChild(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${searchMode === 'client' ? 'bg-white text-violet-700 shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
              <span className="text-lg">👥</span> Por Cliente
            </button>
            <button type="button" onClick={() => { setSearchMode('child'); setSearchTerm(''); setSelectedCustomer(''); setSelectedChild(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${searchMode === 'child' ? 'bg-white text-violet-700 shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
              <span className="text-lg">🧒</span> Por Criança
            </button>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {searchMode === 'client' ? '🔍 Buscar Cliente' : '🔍 Buscar Criança'}
            </label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchMode === 'client' ? 'Digite nome ou telefone...' : 'Digite o nome da criança...'}
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent focus:bg-white transition-all duration-200 shadow-sm hover:shadow-md" />
          </div>

          {searchMode === 'client' && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Cliente</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200/50 rounded-2xl p-2 bg-slate-50/30">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-center text-slate-400 py-4 text-sm">Nenhum cliente encontrado</p>
                  ) : filteredCustomers.map(customer => (
                    <button key={customer.id} type="button" onClick={() => { setSelectedCustomer(customer.id); setSelectedChild(''); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 ${selectedCustomer === customer.id ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-300 shadow-md' : 'hover:bg-white border-2 border-transparent hover:shadow-sm'}`}>
                      <p className="font-bold text-slate-800">{customer.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📞 {customer.phone}</p>
                    </button>
                  ))}
                </div>
              </div>
              {selectedCustomer && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">Criança</label>
                    {customerChildren.length > 1 && (
                      <button type="button" onClick={handleCheckInAll} disabled={loading}
                        className="text-xs font-bold text-violet-600 hover:text-violet-700 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg hover:bg-violet-50">
                        ✓ Check-in em Todos ({customerChildren.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {customerChildren.length === 0 ? (
                      <p className="text-center text-slate-400 py-4 text-sm bg-slate-50 rounded-xl">Sem crianças cadastradas</p>
                    ) : customerChildren.map(child => {
                      const plan = getChildPlan(child.id);
                      return (
                        <button key={child.id} type="button" onClick={() => setSelectedChild(child.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 ${selectedChild === child.id ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-md' : 'hover:bg-white border-2 border-transparent hover:shadow-sm'}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800">{child.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">🎂 {getChildAge(child)} anos</p>
                            </div>
                            {plan && (
                              <span className="text-[10px] bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-1 rounded-full font-bold shadow-sm">
                                🎓 Plano Kids
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {searchMode === 'child' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Resultados</label>
              <div className="space-y-2 max-h-52 overflow-y-auto border border-slate-200/50 rounded-2xl p-2 bg-slate-50/30">
                {searchTerm.trim().length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">Digite o nome da criança acima</p>
                ) : filteredChildrenByName.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">Nenhuma criança encontrada</p>
                ) : filteredChildrenByName.map(child => {
                  const parent = customers.find(c => c.id === child.customerId);
                  const plan = getChildPlan(child.id);
                  return (
                    <button key={child.id} type="button" onClick={() => setSelectedChild(child.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 ${selectedChild === child.id ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-md' : 'hover:bg-white border-2 border-transparent hover:shadow-sm'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">{child.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">🎂 {getChildAge(child)} anos {parent ? `• ${parent.name}` : ''}</p>
                        </div>
                        {plan && (
                          <span className="text-[10px] bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-1 rounded-full font-bold shadow-sm">
                            🎓 Plano Kids
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedChild && getChildPlan(selectedChild) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white text-lg">🎓</span>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-800">Plano Kids Ativo</p>
                <p className="text-xs text-blue-600 mt-0.5">3 horas gratuitas por dia • Excedente cobrado no check-out</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={handleClose} className="flex-1 py-3 rounded-xl border-2 border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm hover:shadow-md">Cancelar</button>
            <button type="submit" disabled={!selectedChild || loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '⏳ Processando...' : selectedChild && getChildPlan(selectedChild) ? '✓ Check-In (Plano Kids)' : '✓ Confirmar Check-In'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

export default CheckInModal;
