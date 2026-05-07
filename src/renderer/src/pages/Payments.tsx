import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Payment } from '../../../shared/types';
import { format } from 'date-fns';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, Button, PageHeader, EmptyState, Skeleton, Badge, cn,
} from '../components/ui';
import { RefreshIcon, MoneyIcon, CreditCardIcon } from '../components/icons/Icons';

const Payments: React.FC = () => {
  const { currentUnit } = useUnit();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'today' | 'month' | 'all'>('today');
  const [selectedMonth] = useState(new Date());
  const [selectedMethod, setSelectedMethod] = useState<string>('all');

  useEffect(() => {
    loadPayments();
  }, [filterType, selectedMonth, currentUnit]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      let allPayments: Payment[];

      if (filterType === 'today') {
        allPayments = await paymentsServiceOffline.getTodayPayments(currentUnit);
      } else if (filterType === 'month') {
        allPayments = await paymentsServiceOffline.getMonthPayments(selectedMonth, currentUnit);
      } else {
        allPayments = await paymentsServiceOffline.getAllPayments(currentUnit);
      }

      setPayments(allPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const getTotalRevenue = () => {
    const filtered = selectedMethod === 'all'
      ? payments
      : payments.filter(p => p.method === selectedMethod);
    return filtered.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getPaymentsByMethod = () => {
    const methods = ['cash', 'pix', 'card', 'package'];
    return methods.map(method => {
      const filtered = method === 'card'
        ? payments.filter(p => p.method === 'credit' || p.method === 'debit')
        : payments.filter(p => p.method === method);
      return {
        method,
        count: filtered.length,
        total: filtered.reduce((sum, p) => sum + p.amount, 0),
      };
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Dinheiro',
      pix: 'PIX',
      card: 'Cartão',
      credit: 'Cartão',
      debit: 'Cartão',
      package: 'Pacote',
    };
    return labels[method] || method;
  };

  const getPaymentMethodIcon = (method: string, className = 'w-5 h-5') => {
    switch (method) {
      case 'cash':
        return (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        );
      case 'pix':
        return (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
        );
      case 'card':
      case 'credit':
      case 'debit':
        return (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
        );
      case 'package':
        return (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        );
      default:
        return (
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        );
    }
  };

  const methodTone = (method: string) => {
    switch (method) {
      case 'cash': return { iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-600', badge: 'emerald' as const };
      case 'pix': return { iconBg: 'bg-gradient-to-br from-cyan-400 to-sky-600', badge: 'blue' as const };
      case 'credit':
      case 'debit':
      case 'card': return { iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-600', badge: 'blue' as const };
      case 'package': return { iconBg: 'bg-brand-gradient', badge: 'brand' as const };
      default: return { iconBg: 'bg-gradient-to-br from-slate-400 to-slate-600', badge: 'slate' as const };
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    const t = methodTone(method);
    const label = method === 'credit' ? 'Crédito'
      : method === 'debit' ? 'Débito'
      : getPaymentMethodLabel(method);
    return <Badge tone={t.badge}>{label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { tone: 'emerald' | 'amber' | 'red'; label: string }> = {
      paid: { tone: 'emerald', label: '✓ Pago' },
      pending: { tone: 'amber', label: 'Pendente' },
      cancelled: { tone: 'red', label: '✗ Cancelado' },
    };
    const item = map[status] || map.pending;
    return <Badge tone={item.tone}>{item.label}</Badge>;
  };

  const filteredPayments = selectedMethod === 'all'
    ? payments
    : selectedMethod === 'card'
      ? payments.filter(p => p.method === 'credit' || p.method === 'debit')
      : payments.filter(p => p.method === selectedMethod);

  const methodStats = getPaymentsByMethod();
  const total = getTotalRevenue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        subtitle={`${payments.length} registros`}
        actions={
          <Button
            variant="outline"
            onClick={loadPayments}
            loading={loading}
            iconLeft={<RefreshIcon size={16} />}
          >
            Atualizar
          </Button>
        }
      />

      {/* Stats principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60" accent>
          <div className="flex items-center justify-between mb-2">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-sm">
              <MoneyIcon size={18} />
            </span>
          </div>
          <p className="text-caption text-emerald-700 uppercase">Receita Total</p>
          <p className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">R$ {total.toFixed(2)}</p>
        </Card>
        <Card padding="md">
          <p className="text-caption text-slate-500 uppercase">Pagamentos</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">{filteredPayments.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-caption text-slate-500 uppercase">Ticket Médio</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            R$ {filteredPayments.length > 0 ? (total / filteredPayments.length).toFixed(2) : '0.00'}
          </p>
        </Card>
      </div>

      {/* Method stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {methodStats.map(stat => {
          const isActive = selectedMethod === stat.method;
          const t = methodTone(stat.method);
          return (
            <button
              key={stat.method}
              onClick={() => setSelectedMethod(stat.method === selectedMethod ? 'all' : stat.method)}
              className={cn(
                'group bg-white rounded-card-lg border p-3 text-left transition-all duration-200',
                'hover:shadow-card-hover hover:-translate-y-0.5',
                isActive ? 'border-brand-400 shadow-brand-sm bg-brand-gradient-soft' : 'border-slate-200',
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn('w-7 h-7 rounded-lg text-white flex items-center justify-center', t.iconBg)}>
                  {getPaymentMethodIcon(stat.method, 'w-3.5 h-3.5')}
                </span>
                <span className="text-xs font-semibold text-slate-700">{getPaymentMethodLabel(stat.method)}</span>
              </div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{stat.count}</p>
              <p className="text-xs font-semibold text-emerald-700 tabular-nums">R$ {stat.total.toFixed(2)}</p>
            </button>
          );
        })}
      </div>

      {/* Filters + Table */}
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/40 to-transparent">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['today', 'month', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  filterType === f
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {f === 'today' ? 'Hoje' : f === 'month' ? 'Este Mês' : 'Todos'}
              </button>
            ))}
          </div>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-lg text-xs font-medium bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
          >
            <option value="all">Todos os métodos</option>
            <option value="cash">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="package">Pacote</option>
          </select>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            icon={<CreditCardIcon size={28} />}
            title="Nenhum pagamento encontrado"
            description="Ajuste os filtros para ver outros períodos"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPayments.map((payment) => {
              const t = methodTone(payment.method);
              return (
                <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm', t.iconBg)} aria-hidden="true">
                      {getPaymentMethodIcon(payment.method, 'w-5 h-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-base text-slate-900 tabular-nums">R$ {payment.amount.toFixed(2)}</p>
                        {getPaymentMethodBadge(payment.method)}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                        {payment.description ? ` • ${payment.description}` : ''}
                        {payment.childName ? ` • ${payment.childName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {getStatusBadge(payment.status)}
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

export default Payments;
