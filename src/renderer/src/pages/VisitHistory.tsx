import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit, Child, Package } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { useUnit } from '../contexts/UnitContext';
import { getChildAge } from '../../../shared/utils/age';

const VisitHistory: React.FC = () => {
  const { currentUnit } = useUnit();
  const [children, setChildren] = useState<Child[]>([]);
  const [filteredChildren, setFilteredChildren] = useState<Child[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'child' | 'today' | 'date' | 'customer'>('child');
  const [customerVisits, setCustomerVisits] = useState<Visit[]>([]);
  const [searchedCustomerName, setSearchedCustomerName] = useState('');
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dateVisits, setDateVisits] = useState<Visit[]>([]);

  useEffect(() => {
    loadChildren();
  }, [currentUnit]);

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

  useEffect(() => {
    if (selectedChildId) {
      setViewMode('child');
      loadChildData();
    }
  }, [selectedChildId]);

  const loadCustomerVisits = async () => {
    if (!searchTerm.trim()) return;
    try {
      setLoading(true);
      setViewMode('customer');
      setSelectedChildId('');
      const term = searchTerm.toLowerCase();
      // Find matching customers by name
      const matchedCustomers = customers.filter(c => c.name.toLowerCase().includes(term));
      if (matchedCustomers.length === 0) {
        setCustomerVisits([]);
        setSearchedCustomerName(searchTerm);
        setLoading(false);
        return;
      }
      // Get all children of matched customers
      const matchedCustomerIds = new Set(matchedCustomers.map(c => c.id));
      const matchedChildren = children.filter(c => matchedCustomerIds.has(c.customerId));
      const matchedChildIds = new Set(matchedChildren.map(c => c.id));
      // Get all visits for those children
      const allVisits = await visitsServiceOffline.getAllVisits(currentUnit);
      const filtered = allVisits
        .filter(v => matchedChildIds.has(v.childId))
        .sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      setCustomerVisits(filtered);
      setSearchedCustomerName(matchedCustomers.map(c => c.name).join(', '));
    } catch (error) {
      console.error('Error loading customer visits:', error);
      toast.error('Erro ao carregar visitas do responsável');
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async () => {
    try {
      const [allChildren, allCustomers] = await Promise.all([
        customersServiceOffline.getAllChildren(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
      ]);
      setChildren(allChildren);
      setFilteredChildren(allChildren);
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading children:', error);
      toast.error('Erro ao carregar crianças');
    }
  };

  const loadChildData = async () => {
    if (!selectedChildId) return;
    
    try {
      setLoading(true);
      
      // Buscar visitas da criança
      const allVisits = await visitsServiceOffline.getAllVisits(currentUnit);
      const childVisits = allVisits
        .filter(v => v.childId === selectedChildId)
        .sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      setVisits(childVisits);

      // Buscar pacotes da criança (filtrado pela unidade)
      const allPackages = await packagesServiceOffline.getActivePackages(undefined, currentUnit);
      const childPackages = allPackages.filter(p => p.childId === selectedChildId);
      setPackages(childPackages);
    } catch (error) {
      console.error('Error loading child data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const calculateDuration = (checkIn: Date, checkOut?: Date) => {
    const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
    const end = checkOut ? (checkOut instanceof Date ? checkOut : new Date(checkOut)) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60));
  };

  const loadTodayVisits = async () => {
    try {
      setLoading(true);
      setViewMode('today');
      setSelectedChildId('');
      const allVisits = await visitsServiceOffline.getAllVisits(currentUnit);
      const today = allVisits
        .filter(v => {
          const checkIn = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
          return isToday(checkIn);
        })
        .sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      setTodayVisits(today);
    } catch (error) {
      console.error('Error loading today visits:', error);
      toast.error('Erro ao carregar visitas do dia');
    } finally {
      setLoading(false);
    }
  };

  const loadDateVisits = async (dateStr: string) => {
    try {
      setLoading(true);
      setViewMode('date');
      setSelectedChildId('');
      const targetDate = new Date(dateStr + 'T00:00:00');
      const allVisits = await visitsServiceOffline.getAllVisits(currentUnit);
      const filtered = allVisits
        .filter(v => {
          const checkIn = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
          return isSameDay(checkIn, targetDate);
        })
        .sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      setDateVisits(filtered);
    } catch (error) {
      console.error('Error loading date visits:', error);
      toast.error('Erro ao carregar visitas da data');
    } finally {
      setLoading(false);
    }
  };

  const getChildName = (childId: string) => {
    const child = children.find(c => c.id === childId);
    return child?.name || 'Desconhecido';
  };

  const getCustomerNameByChildId = (childId: string) => {
    const child = children.find(c => c.id === childId);
    if (!child) return '';
    const customer = customers.find(c => c.id === child.customerId);
    return customer?.name || '';
  };

  const activeVisits = viewMode === 'today' ? todayVisits : viewMode === 'date' ? dateVisits : viewMode === 'customer' ? customerVisits : visits;

  const totalVisits = activeVisits.filter(v => v.checkOut).length;
  const totalMinutes = activeVisits
    .filter(v => v.checkOut)
    .reduce((sum, v) => sum + calculateDuration(v.checkIn, v.checkOut), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Histórico de Visitas</h1>
        <p className="text-sm text-slate-500">Visualize visitas e saldo de pacotes</p>
      </div>

      {/* Search + Select */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Buscar criança ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && loadCustomerVisits()}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={loadCustomerVisits}
            disabled={!searchTerm.trim()}
            className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${viewMode === 'customer' ? 'bg-violet-600 text-white' : 'border border-violet-300 text-violet-600 hover:bg-violet-50'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Buscar por responsável
          </button>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Selecione uma criança...</option>
            {filteredChildren.map((child) => {
              const customer = customers.find((c: any) => c.id === child.customerId);
              return (
                <option key={child.id} value={child.id}>
                  {child.name} ({getChildAge(child)}a) - {customer?.name || '-'}
                </option>
              );
            })}
          </select>
          <button
            onClick={loadTodayVisits}
            className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'today' ? 'bg-violet-600 text-white' : 'border border-violet-300 text-violet-600 hover:bg-violet-50'}`}
          >
            Visitas de hoje
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={() => loadDateVisits(selectedDate)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'date' ? 'bg-violet-600 text-white' : 'border border-violet-300 text-violet-600 hover:bg-violet-50'}`}
          >
            Buscar por data
          </button>
        </div>
        {searchTerm && filteredChildren.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">Nenhuma criança encontrada</p>
        )}
      </div>

      {(selectedChildId || viewMode === 'today' || viewMode === 'date' || viewMode === 'customer') && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Total Visitas</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalVisits}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Tempo Total</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatDuration(totalMinutes)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">Pacotes Ativos</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{packages.length}</p>
            </div>
          </div>

          {/* Packages */}
          {packages.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Saldo dos Pacotes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {packages.map((pkg) => {
                  const remaining = Math.max(pkg.hours - pkg.usedHours, 0);
                  const progress = (pkg.usedHours / pkg.hours) * 100;
                  const isExpired = pkg.expiresAt && new Date(pkg.expiresAt) < new Date();
                  return (
                    <div key={pkg.id} className={`border rounded-lg p-4 ${pkg.active && !isExpired ? 'border-violet-200' : 'border-slate-200 opacity-60'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{pkg.type}</p>
                          <p className="text-xs text-slate-500">{format(new Date(pkg.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pkg.active && !isExpired ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {isExpired ? 'Expirado' : pkg.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>{pkg.usedHours.toFixed(1)}h / {pkg.hours}h</span>
                        <span className="font-semibold">{remaining.toFixed(1)}h restam</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visits List */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                {viewMode === 'today' ? `Visitas de Hoje (${activeVisits.length})` : viewMode === 'date' ? `Visitas de ${format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')} (${activeVisits.length})` : viewMode === 'customer' ? `Visitas de ${searchedCustomerName} (${activeVisits.length})` : 'Visitas'}
              </h2>
              <button onClick={viewMode === 'today' ? loadTodayVisits : viewMode === 'date' ? () => loadDateVisits(selectedDate) : viewMode === 'customer' ? loadCustomerVisits : loadChildData} disabled={loading} className="text-sm text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50">
                {loading ? '⏳' : '🔄'} Atualizar
              </button>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-slate-100 rounded-lg" />)}
              </div>
            ) : activeVisits.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-2">📋</p>
                <p className="font-medium">Nenhuma visita encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeVisits.map((visit) => {
                  const checkInDate = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
                  const checkOutDate = visit.checkOut ? (visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut)) : null;
                  const duration = checkOutDate ? calculateDuration(checkInDate, checkOutDate) : null;
                  const isActive = !visit.checkOut;
                  const isCancelled = (visit as any).paymentMethod === 'cancelled';
                  const usedPackage = !!visit.packageId;
                  const paymentMethodLabel = isCancelled ? 'Cancelado' : usedPackage ? 'Pacote' : (visit as any).paymentMethod === 'pix' ? 'PIX' : (visit as any).paymentMethod === 'credit' ? 'Crédito' : (visit as any).paymentMethod === 'debit' ? 'Débito' : visit.value && visit.value > 0 ? 'Pagamento' : '';
                  return (
                    <div key={visit.id} className={`flex items-center justify-between p-4 ${isActive ? 'bg-emerald-50' : isCancelled ? 'bg-red-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : isCancelled ? 'bg-red-400' : 'bg-slate-300'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            {(viewMode === 'today' || viewMode === 'date' || viewMode === 'customer') && (
                              <p className="font-semibold text-sm text-violet-700">{getChildName(visit.childId)}</p>
                            )}
                            <p className="font-medium text-sm text-slate-800">
                              {viewMode === 'customer' ? format(checkInDate, "EEEE, dd/MM", { locale: ptBR }) : (viewMode === 'today' || viewMode === 'date') ? '' : format(checkInDate, "EEEE, dd/MM", { locale: ptBR })}
                            </p>
                            {isCancelled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">Cancelado</span>}
                            {usedPackage && !isCancelled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">Pacote</span>}
                          </div>
                          <p className="text-xs text-slate-500">
                            {(viewMode === 'today' || viewMode === 'date' || viewMode === 'customer') && <span>{getCustomerNameByChildId(visit.childId)} · </span>}
                            {format(checkInDate, 'HH:mm')}{checkOutDate ? ` → ${format(checkOutDate, 'HH:mm')}` : ''}
                            {!isActive && !isCancelled && paymentMethodLabel ? ` · ${paymentMethodLabel}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isActive ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Em andamento</span>
                        ) : (
                          <div>
                            <p className={`font-bold text-sm ${isCancelled ? 'text-red-500 line-through' : 'text-slate-800'}`}>{duration !== null ? formatDuration(duration) : '-'}</p>
                            {!isCancelled && visit.value && visit.value > 0 && <p className="text-xs text-emerald-600 font-medium">R$ {visit.value.toFixed(2)}</p>}
                            {usedPackage && !isCancelled && <p className="text-[10px] text-violet-500 font-medium">via pacote</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VisitHistory;
