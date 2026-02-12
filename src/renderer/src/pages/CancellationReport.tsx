import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { useUnit } from '../contexts/UnitContext';

const CancellationReport: React.FC = () => {
  const { currentUnit } = useUnit();
  const [filterType, setFilterType] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [cancellations, setCancellations] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCancellations();
  }, [filterType, selectedDate, selectedMonth, currentUnit]);

  const loadCancellations = async () => {
    try {
      setLoading(true);
      const allVisits = await visitsServiceOffline.getAllVisits();

      let startDate: Date;
      let endDate: Date;

      if (filterType === 'day') {
        const date = new Date(selectedDate + 'T00:00:00');
        startDate = startOfDay(date);
        endDate = endOfDay(date);
      } else {
        const date = new Date(selectedMonth + '-01T00:00:00');
        startDate = startOfMonth(date);
        endDate = endOfMonth(date);
      }

      const filtered = (allVisits as any[]).filter(v => {
        const checkInDate = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
        const inRange = checkInDate >= startDate && checkInDate <= endDate;
        const isCancelled = v.paymentMethod === 'cancelled';
        const matchesUnit = v.unitId === currentUnit;
        return inRange && isCancelled && matchesUnit;
      }).sort((a, b) => {
        const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
        const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
        return bTime - aTime;
      });

      // Enrich with child data
      const enriched = await visitsServiceOffline.enrichVisitsWithChildData(filtered as Visit[]);
      setCancellations(enriched);
    } catch (error) {
      console.error('Error loading cancellations:', error);
      toast.error('Erro ao carregar cancelamentos');
    } finally {
      setLoading(false);
    }
  };

  const totalMinutes = cancellations.reduce((sum, v) => sum + (v.duration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Relatório de Cancelamentos</h1>
        <p className="text-sm text-slate-500">Controle de check-ins cancelados por período</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Período</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterType('day')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'day' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Dia
              </button>
              <button
                onClick={() => setFilterType('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Mês
              </button>
            </div>
          </div>

          {filterType === 'day' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mês</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          <button
            onClick={loadCancellations}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? '⏳' : '🔄'} Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Total Cancelamentos</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{cancellations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Minutos Registrados</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalMinutes} min</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Cancelamentos</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-14 bg-slate-100 rounded-lg" />)}
          </div>
        ) : cancellations.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">✅</p>
            <p className="font-medium">Nenhum cancelamento no período</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cancellations.map((visit) => {
              const checkInDate = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
              const checkOutDate = visit.checkOut ? (visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut)) : null;
              return (
                <div key={visit.id} className="flex items-center justify-between p-4 hover:bg-red-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-800">{visit.child?.name || 'Criança'}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">Cancelado</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {format(checkInDate, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                        {checkOutDate ? ` → ${format(checkOutDate, 'HH:mm')}` : ''}
                        {visit.child?.customer?.name ? ` · ${visit.child.customer.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-red-500">{visit.duration || 0} min</p>
                    <p className="text-[10px] text-slate-400">registrados</p>
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

export default CancellationReport;
