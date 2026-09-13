import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, Button, PageHeader, EmptyState, Skeleton, Badge, cn,
} from '../components/ui';
import { RefreshIcon, BanIcon } from '../components/icons/Icons';

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
      const allVisits = await visitsServiceOffline.getAllVisits(currentUnit);

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
      <PageHeader
        title="Relatório de Cancelamentos"
        subtitle="Controle de check-ins cancelados por período"
      />

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">Período</label>
            <div className="flex gap-1 bg-ink-100 p-1 rounded-lg">
              {(['day', 'month'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-semibold transition-all',
                    filterType === f
                      ? 'bg-paper-raised text-brand-700 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700',
                  )}
                >
                  {f === 'day' ? 'Dia' : 'Mês'}
                </button>
              ))}
            </div>
          </div>

          {filterType === 'day' ? (
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1.5">Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 px-3 border border-line rounded-lg text-sm bg-paper-raised hover:border-brand-300 focus:border-brand-500 focus-visible:shadow-focus focus:outline-none transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1.5">Mês</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 px-3 border border-line rounded-lg text-sm bg-paper-raised hover:border-brand-300 focus:border-brand-500 focus-visible:shadow-focus focus:outline-none transition-all"
              />
            </div>
          )}

          <Button
            variant="outline"
            onClick={loadCancellations}
            loading={loading}
            iconLeft={<RefreshIcon size={16} />}
          >
            Atualizar
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md" className="relative overflow-hidden bg-state-bad-soft border-state-bad/30">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-md bg-ink-100 text-ink-500 flex items-center justify-center shadow-sm">
              <BanIcon size={18} />
            </span>
          </div>
          <p className="text-caption text-state-bad uppercase">Total Cancelamentos</p>
          <p className="text-3xl font-bold text-state-bad tabular-nums mt-1">{cancellations.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-caption text-ink-500 uppercase">Minutos Registrados</p>
          <p className="text-readout text-ink-900 tabular-nums mt-1">{totalMinutes} min</p>
        </Card>
      </div>

      {/* List */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-line-subtle bg-state-bad-soft">
          <h2 className="text-caption uppercase text-ink-500">Cancelamentos</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : cancellations.length === 0 ? (
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7 text-state-ok" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
            title="Nenhum cancelamento no período"
            description="Tudo certo por aqui."
          />
        ) : (
          <div className="divide-y divide-line-subtle">
            {cancellations.map((visit) => {
              const checkInDate = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
              const checkOutDate = visit.checkOut ? (visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut)) : null;
              return (
                <div key={visit.id} className="relative flex items-center justify-between pl-5 pr-5 py-3 hover:bg-state-bad-soft transition-colors">
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-state-bad" aria-hidden="true" />
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-ink-900">{visit.child?.name || 'Criança'}</p>
                        <Badge tone="red" size="sm">Cancelado</Badge>
                      </div>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {format(checkInDate, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                        {checkOutDate ? ` → ${format(checkOutDate, 'HH:mm')}` : ''}
                        {visit.child?.customer?.name ? ` · ${visit.child.customer.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-state-bad tabular-nums">{visit.duration || 0} min</p>
                    <p className="text-[10px] text-ink-400">registrados</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CancellationReport;
