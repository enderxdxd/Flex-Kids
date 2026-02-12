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
        allPayments = await paymentsServiceOffline.getTodayPayments();
      } else if (filterType === 'month') {
        allPayments = await paymentsServiceOffline.getMonthPayments(selectedMonth);
      } else {
        allPayments = await paymentsServiceOffline.getAllPayments();
      }
      
      const unitPayments = allPayments.filter(p => !p.unitId || p.unitId === currentUnit);
      setPayments(unitPayments);
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
    const methods = ['dinheiro', 'pix', 'cartao', 'pacote'];
    return methods.map(method => ({
      method,
      count: payments.filter(p => p.method === method).length,
      total: payments.filter(p => p.method === method).reduce((sum, p) => sum + p.amount, 0),
    }));
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      dinheiro: '💵 Dinheiro',
      pix: '📱 PIX',
      cartao: '💳 Cartão',
      pacote: '📦 Pacote',
    };
    return labels[method] || method;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: '✓ Pago' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Pendente' },
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
          {loading ? '⏳' : '🔄'} Atualizar
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
              <span className="text-sm">{getPaymentMethodLabel(stat.method).split(' ')[0]}</span>
              <span className="text-xs font-medium text-slate-600">{getPaymentMethodLabel(stat.method).split(' ')[1]}</span>
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
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="cartao">Cartão</option>
            <option value="pacote">Pacote</option>
          </select>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">💰</p>
            <p className="font-medium">Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{getPaymentMethodLabel(payment.method).split(' ')[0]}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800">R$ {payment.amount.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                      {payment.description ? ` — ${payment.description}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-slate-500">{getPaymentMethodLabel(payment.method).split(' ')[1]}</span>
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
