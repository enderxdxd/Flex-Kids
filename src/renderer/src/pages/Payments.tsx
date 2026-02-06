import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Payment } from '../../../shared/types';
import { format } from 'date-fns';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'today' | 'month' | 'all'>('today');
  const [selectedMonth] = useState(new Date());
  const [selectedMethod, setSelectedMethod] = useState<string>('all');

  useEffect(() => {
    loadPayments();
  }, [filterType, selectedMonth]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Pagamentos</h1>
          <p className="text-gray-500">Histórico e relatórios financeiros - {payments.length} pagamentos</p>
        </div>
        <button
          onClick={loadPayments}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-100 text-sm font-medium">Receita Total</p>
            <span className="text-3xl">💰</span>
          </div>
          <p className="text-4xl font-bold">R$ {getTotalRevenue().toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-100 text-sm font-medium">Total de Pagamentos</p>
            <span className="text-3xl">📊</span>
          </div>
          <p className="text-4xl font-bold">{filteredPayments.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-purple-100 text-sm font-medium">Ticket Médio</p>
            <span className="text-3xl">📈</span>
          </div>
          <p className="text-4xl font-bold">
            R$ {filteredPayments.length > 0 ? (getTotalRevenue() / filteredPayments.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Por Método de Pagamento</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {methodStats.map(stat => (
            <div key={stat.method} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
              <div className="text-2xl mb-2">{getPaymentMethodLabel(stat.method).split(' ')[0]}</div>
              <div className="text-sm text-gray-600 mb-1">{getPaymentMethodLabel(stat.method).split(' ')[1]}</div>
              <div className="text-lg font-bold text-gray-800">{stat.count} pag.</div>
              <div className="text-sm font-medium text-green-600">R$ {stat.total.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('today')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                filterType === 'today'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Hoje
            </button>
            <button
              onClick={() => setFilterType('month')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                filterType === 'month'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📆 Este Mês
            </button>
            <button
              onClick={() => setFilterType('all')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                filterType === 'all'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Todos
            </button>
          </div>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todos os métodos</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="cartao">Cartão</option>
            <option value="pacote">Pacote</option>
          </select>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-4">Histórico de Pagamentos</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-4 border border-gray-200 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-6xl mb-4">💰</p>
            <p className="text-xl font-medium">Nenhum pagamento encontrado</p>
            <p className="text-sm mt-2">Aguardando o primeiro pagamento!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getPaymentMethodLabel(payment.method).split(' ')[0]}</span>
                      <div>
                        <p className="font-bold text-lg text-gray-800">
                          R$ {payment.amount.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    {payment.description && (
                      <p className="text-sm text-gray-600 ml-11">{payment.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                      <p className="text-sm font-medium text-gray-700">
                        {getPaymentMethodLabel(payment.method).split(' ')[1]}
                      </p>
                    </div>
                    {getStatusBadge(payment.status)}
                  </div>
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
