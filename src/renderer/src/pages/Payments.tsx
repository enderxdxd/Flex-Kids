import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Payment } from '@shared/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { paymentsService } from '@shared/firebase/services';

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'today' | 'all'>('today');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadPayments();
  }, [filterType, selectedMonth]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = filterType === 'today'
        ? await paymentsService.getPaymentsByDateRange(
          new Date(),
          new Date()
        )
        : await paymentsService.getPaymentsByDateRange(
          startOfMonth(selectedMonth),
          endOfMonth(selectedMonth)
        );
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const getTotalRevenue = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      cartao: 'Cartão',
      pacote: 'Pacote',
    };
    return labels[method] || method;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Pago' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Pagamentos</h1>
        <p className="text-gray-500 mt-2">Histórico e relatórios financeiros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm font-medium">Receita Total</p>
          <p className="text-3xl font-bold mt-2">R$ {getTotalRevenue().toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium">Total de Pagamentos</p>
          <p className="text-3xl font-bold mt-2">{payments.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm font-medium">Ticket Médio</p>
          <p className="text-3xl font-bold mt-2">
            R$ {payments.length > 0 ? (getTotalRevenue() / payments.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setFilterType('today')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'today'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Histórico de Pagamentos</h2>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum pagamento encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Data</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Valor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Método</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      R$ {payment.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getPaymentMethodLabel(payment.method)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;
