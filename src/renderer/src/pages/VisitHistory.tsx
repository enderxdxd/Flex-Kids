import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { format, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { useUnit } from '../contexts/UnitContext';

const VisitHistory: React.FC = () => {
  const { currentUnit } = useUnit();
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'date'>('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    loadAll();
  }, [currentUnit]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [visits, allChildren, allCustomers] = await Promise.all([
        visitsServiceOffline.getAllVisits(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
      ]);
      const sorted = [...visits].sort((a, b) => {
        const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
        const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
        return bTime - aTime;
      });
      setAllVisits(sorted);
      setChildren(allChildren);
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading visits:', error);
      toast.error('Erro ao carregar visitas');
    } finally {
      setLoading(false);
    }
  };

  const getChild = (childId: string) => children.find(c => c.id === childId);
  const getCustomer = (childId: string) => {
    const child = getChild(childId);
    return child ? customers.find(c => c.id === child.customerId) : undefined;
  };

  const filteredVisits = useMemo(() => {
    let result = allVisits;

    // Date filter
    if (dateFilter === 'today') {
      result = result.filter(v => {
        const d = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
        return isToday(d);
      });
    } else if (dateFilter === 'date') {
      const target = new Date(selectedDate + 'T00:00:00');
      result = result.filter(v => {
        const d = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
        return isSameDay(d, target);
      });
    }

    // Search filter — matches child name OR customer name
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(v => {
        const child = getChild(v.childId);
        const customer = child ? customers.find(c => c.id === child.customerId) : undefined;
        return (
          child?.name?.toLowerCase().includes(term) ||
          customer?.name?.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [allVisits, searchTerm, dateFilter, selectedDate, children, customers]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  };

  const calculateDuration = (checkIn: Date, checkOut?: Date) => {
    const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
    const end = checkOut ? (checkOut instanceof Date ? checkOut : new Date(checkOut)) : new Date();
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
  };

  const completedVisits = filteredVisits.filter(v => v.checkOut);
  const totalMinutes = completedVisits.reduce((sum, v) => sum + calculateDuration(v.checkIn, v.checkOut), 0);
  const activeCount = filteredVisits.filter(v => !v.checkOut).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Histórico de Visitas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Todas as visitas · busca por criança ou responsável</p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-semibold bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por criança ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Date filter pills + date picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${dateFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Todas as datas
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${dateFilter === 'today' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Hoje
          </button>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setDateFilter('date'); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${dateFilter === 'date' ? 'border-violet-500 text-violet-700 bg-violet-50' : 'border-slate-200 text-slate-600 bg-slate-100'}`}
            />
            {dateFilter === 'date' && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-600">
                {format(new Date(selectedDate + 'T00:00:00'), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Visitas</p>
            <p className="text-2xl font-bold text-slate-800">{completedVisits.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Tempo Total</p>
            <p className="text-2xl font-bold text-slate-800">{formatDuration(totalMinutes)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Em Andamento</p>
            <p className="text-2xl font-bold text-slate-800">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Visits List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {filteredVisits.length} visita{filteredVisits.length !== 1 ? 's' : ''}
            {searchTerm && <span className="ml-1 font-normal normal-case text-slate-400">para "{searchTerm}"</span>}
            {dateFilter === 'today' && <span className="ml-1 font-normal normal-case text-slate-400">· hoje</span>}
            {dateFilter === 'date' && <span className="ml-1 font-normal normal-case text-slate-400">· {format(new Date(selectedDate + 'T00:00:00'), "dd/MM/yyyy")}</span>}
          </p>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-2/5" />
                  <div className="h-2 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-14" />
              </div>
            ))}
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium text-sm">Nenhuma visita encontrada</p>
            <p className="text-xs mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredVisits.map((visit) => {
              const checkInDate = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
              const checkOutDate = visit.checkOut
                ? (visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut))
                : null;
              const duration = checkOutDate ? calculateDuration(checkInDate, checkOutDate) : null;
              const isActive = !visit.checkOut;
              const isCancelled = (visit as any).paymentMethod === 'cancelled';
              const usedPackage = !!visit.packageId;
              const paymentLabel = isCancelled || usedPackage ? '' :
                (visit as any).paymentMethod === 'pix' ? 'PIX' :
                (visit as any).paymentMethod === 'credit' ? 'Crédito' :
                (visit as any).paymentMethod === 'debit' ? 'Débito' : '';

              const child = getChild(visit.childId);
              const customer = getCustomer(visit.childId);

              return (
                <div
                  key={visit.id}
                  className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                    isActive ? 'bg-emerald-50/60' : isCancelled ? 'bg-red-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                      isActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : isCancelled ? 'bg-red-400' : 'bg-slate-300'
                    }`} />

                    <div className="min-w-0">
                      {/* Child + customer */}
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-sm text-violet-700 truncate">
                          {child?.name || 'Desconhecido'}
                        </p>
                        {(child?.observations || customer?.observations) && (
                          <div className="relative group flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-amber-500 cursor-default" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20 w-60 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-2xl pointer-events-none">
                              {child?.observations && (
                                <div className="mb-1.5 last:mb-0">
                                  <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Criança</p>
                                  <p className="leading-snug">{child.observations}</p>
                                </div>
                              )}
                              {customer?.observations && (
                                <div className="mb-1.5 last:mb-0">
                                  <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Responsável</p>
                                  <p className="leading-snug">{customer.observations}</p>
                                </div>
                              )}
                              <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                            </div>
                          </div>
                        )}
                        {customer?.name && (
                          <>
                            <span className="text-slate-300 flex-shrink-0">·</span>
                            <p className="text-xs text-slate-400 truncate">{customer.name}</p>
                          </>
                        )}
                      </div>

                      {/* Date + time */}
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-600 font-medium capitalize">
                          {format(checkInDate, "EEE, dd/MM", { locale: ptBR })}
                        </p>
                        <span className="text-slate-300">·</span>
                        <p className="text-xs text-slate-500">
                          {format(checkInDate, 'HH:mm')}
                          {checkOutDate ? ` → ${format(checkOutDate, 'HH:mm')}` : ' → em andamento'}
                        </p>
                      </div>

                      {/* Badges */}
                      {(isCancelled || usedPackage || paymentLabel) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {isCancelled && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Cancelado</span>
                          )}
                          {usedPackage && !isCancelled && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">Pacote</span>
                          )}
                          {paymentLabel && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{paymentLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="text-right flex-shrink-0 ml-4">
                    {isActive ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        Em andamento
                      </span>
                    ) : (
                      <div>
                        <p className={`font-bold text-sm ${isCancelled ? 'text-red-400 line-through' : 'text-slate-800'}`}>
                          {duration !== null ? formatDuration(duration) : '—'}
                        </p>
                        {!isCancelled && visit.value && visit.value > 0 && (
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            R$ {visit.value.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitHistory;
