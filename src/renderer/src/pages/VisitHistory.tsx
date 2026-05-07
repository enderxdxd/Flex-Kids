import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { format, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { bematechService } from '../../../shared/services/bematech.service';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, Button, IconButton, PageHeader, EmptyState, Skeleton, Badge, Input, cn,
} from '../components/ui';
import { RefreshIcon, ClipboardIcon } from '../components/icons/Icons';

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
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const handleReprint = async (visit: Visit) => {
    const child = getChild(visit.childId);
    const customer = getCustomer(visit.childId);
    if (!child) { toast.error('Criança não encontrada'); return; }

    setReprintingId(visit.id);
    try {
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);
      if (!fiscalConfig?.enableFiscalPrint) {
        toast.warning('Impressão fiscal não está habilitada nas configurações');
        return;
      }

      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) {
        toast.warning('Impressora não conectada');
        return;
      }

      const checkIn = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
      const checkOut = visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut!);
      const dur = calculateDuration(checkIn, checkOut);
      const fmtTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const payLabel = visit.kidsPlanId ? 'PLANO KIDS' : visit.packageId ? 'PACOTE' : 'AVULSO';

      const lines = [
        '================================',
        '       ** 2a VIA **',
        '================================',
        `CRIANCA: ${child.name}`,
        ...(child.cpf ? [`CPF: ${child.cpf}`] : []),
        `RESPONSAVEL: ${customer?.name || 'N/A'}`,
        '',
        `ENTRADA: ${fmtTime(checkIn)}`,
        `SAIDA: ${fmtTime(checkOut)}`,
        `DURACAO: ${Math.floor(dur / 60)}h ${dur % 60}min`,
        '',
        `VALOR TOTAL: R$ ${(visit.value || 0).toFixed(2)}`,
        `PAGAMENTO: ${payLabel}`,
        '================================',
        `DATA: ${format(checkIn, 'dd/MM/yyyy')}`,
        'Obrigado pela preferencia!',
      ];

      const printed = await bematechService.printNonFiscalReport('COMPROVANTE DE ATENDIMENTO', lines);
      if (printed) toast.success('Comprovante reimpresso!');
      else toast.warning('Impressora não respondeu');
    } catch (error) {
      console.error('Reprint error:', error);
      toast.error('Erro ao reimprimir comprovante');
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Histórico de Visitas"
        subtitle="Todas as visitas · busca por criança ou responsável"
        actions={
          <Button
            variant="outline"
            onClick={loadAll}
            loading={loading}
            iconLeft={<RefreshIcon size={16} />}
          >
            Atualizar
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="md" className="space-y-3">
        <Input
          type="text"
          placeholder="Buscar por criança ou responsável..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          iconLeft={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDateFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              dateFilter === 'all'
                ? 'bg-brand-gradient text-white shadow-brand-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            Todas as datas
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              dateFilter === 'today'
                ? 'bg-brand-gradient text-white shadow-brand-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Hoje
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setDateFilter('date'); }}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-brand-100',
              dateFilter === 'date'
                ? 'border-brand-400 text-brand-700 bg-brand-gradient-soft'
                : 'border-slate-200 text-slate-600 bg-white hover:border-brand-300',
            )}
          />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-sm">
              <ClipboardIcon size={18} />
            </span>
            <div>
              <p className="text-caption text-slate-500 uppercase">Total Visitas</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{completedVisits.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <p className="text-caption text-slate-500 uppercase">Tempo Total</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatDuration(totalMinutes)}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div>
              <p className="text-caption text-slate-500 uppercase">Em Andamento</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{activeCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* List */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-brand-50/40 to-transparent">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {filteredVisits.length} visita{filteredVisits.length !== 1 ? 's' : ''}
            {searchTerm && <span className="ml-1 font-normal normal-case text-slate-400">para "{searchTerm}"</span>}
            {dateFilter === 'today' && <span className="ml-1 font-normal normal-case text-slate-400">· hoje</span>}
            {dateFilter === 'date' && <span className="ml-1 font-normal normal-case text-slate-400">· {format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy')}</span>}
          </p>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon size={28} />}
            title="Nenhuma visita encontrada"
            description="Tente ajustar os filtros"
          />
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

              const stripe = isActive
                ? 'bg-gradient-to-b from-emerald-400 to-teal-500'
                : isCancelled
                  ? 'bg-gradient-to-b from-red-400 to-rose-500'
                  : 'bg-slate-200';

              return (
                <div
                  key={visit.id}
                  className={cn(
                    'relative flex items-center justify-between pl-5 pr-5 py-3.5 transition-colors',
                    isActive ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : isCancelled ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/60',
                  )}
                >
                  <span className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-r-full', stripe)} aria-hidden="true" />

                  <div className="flex items-start gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-sm text-brand-700 truncate">
                          {child?.name || 'Desconhecido'}
                        </p>
                        {(child?.observations || customer?.observations) && (
                          <div className="relative group flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-amber-500 cursor-default" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20 w-60 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-card-lg pointer-events-none">
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

                      <div className="flex items-center gap-2 tabular-nums">
                        <p className="text-xs text-slate-600 font-medium capitalize">
                          {format(checkInDate, "EEE, dd/MM", { locale: ptBR })}
                        </p>
                        <span className="text-slate-300">·</span>
                        <p className="text-xs text-slate-500">
                          {format(checkInDate, 'HH:mm')}
                          {checkOutDate ? ` → ${format(checkOutDate, 'HH:mm')}` : ' → em andamento'}
                        </p>
                      </div>

                      {(isCancelled || usedPackage || paymentLabel) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {isCancelled && <Badge tone="red" size="sm">Cancelado</Badge>}
                          {usedPackage && !isCancelled && <Badge tone="brand" size="sm">Pacote</Badge>}
                          {paymentLabel && <Badge tone="slate" size="sm">{paymentLabel}</Badge>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {isActive ? (
                      <Badge tone="emerald">Em andamento</Badge>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className={cn(
                            'font-bold text-sm tabular-nums',
                            isCancelled ? 'text-red-400 line-through' : 'text-slate-900',
                          )}>
                            {duration !== null ? formatDuration(duration) : '—'}
                          </p>
                          {!isCancelled && visit.value && visit.value > 0 && (
                            <p className="text-xs text-emerald-700 font-semibold tabular-nums mt-0.5">
                              R$ {visit.value.toFixed(2)}
                            </p>
                          )}
                        </div>
                        {!isCancelled && (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReprint(visit)}
                            disabled={reprintingId === visit.id}
                            aria-label="Reimprimir comprovante"
                            title="Reimprimir comprovante"
                          >
                            <svg className={cn('w-4 h-4', reprintingId === visit.id && 'animate-pulse')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </IconButton>
                        )}
                      </>
                    )}
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

export default VisitHistory;
