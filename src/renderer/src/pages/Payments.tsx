import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Payment } from '../../../shared/types';
import { format } from 'date-fns';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { useUnit } from '../contexts/UnitContext';

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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        );
      case 'pix':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
        );
      case 'card':
      case 'credit':
      case 'debit':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
        );
      case 'package':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        );
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      cash: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Dinheiro' },
      pix: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'PIX' },
      credit: { bg: 'bg-blue-100', text: 'text-blue-700', label: method === 'credit' ? 'Crédito' : 'Débito' },
      debit: { bg: 'bg-blue-100', text: 'text-blue-700', label: method === 'credit' ? 'Crédito' : 'Débito' },
      package: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Pacote' },
    };
    const badge = badges[method] || { bg: 'bg-slate-100', text: 'text-slate-700', label: method };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: '✓ Pago' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: '✗ Cancelado' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-3 py-1 text-xs font-bold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const filteredPayments = selectedMethod === 'all'
    ? payments
    : selectedMethod === 'card'
      ? payments.filter(p => p.method === 'credit' || p.method === 'debit')
      : payments.filter(p => p.method === selectedMethod);

  const methodStats = getPaymentsByMethod();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pagamentos</h1>
          <p className="text-sm text-slate-500">{payments.length} registros</p>
        </div>
        <button onClick={loadPayments} disabled={loading} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {loading ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline-block animate-spin">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline-block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          )} Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Receita Total</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">R$ {getTotalRevenue().toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Pagamentos</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{filteredPayments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Ticket Médio</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">R$ {filteredPayments.length > 0 ? (getTotalRevenue() / filteredPayments.length).toFixed(2) : '0.00'}</p>
        </div>
      </div>

      {/* Method Stats */}
      <div className="grid grid-cols-4 gap-3">
        {methodStats.map(stat => (
          <div key={stat.method} className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setSelectedMethod(stat.method === selectedMethod ? 'all' : stat.method)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-500">{getPaymentMethodIcon(stat.method, 'w-4 h-4')}</span>
              <span className="text-xs font-medium text-slate-600">{getPaymentMethodLabel(stat.method)}</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{stat.count}</p>
            <p className="text-xs font-medium text-emerald-600">R$ {stat.total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['today', 'month', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilterType(f)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterType === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'today' ? 'Hoje' : f === 'month' ? 'Este Mês' : 'Todos'}
              </button>
            ))}
          </div>
          <select value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="all">Todos os métodos</option>
            <option value="cash">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="package">Pacote</option>
          </select>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-2 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="font-medium">Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 text-slate-500">
                    {getPaymentMethodIcon(payment.method, 'w-5 h-5')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-base text-slate-800">R$ {payment.amount.toFixed(2)}</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;
