import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payment } from '../../../shared/types';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';

const CashReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [selectedDate]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      const date = new Date(selectedDate + 'T00:00:00');
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('[CASH REPORT] Carregando pagamentos para:', selectedDate);
      console.log('[CASH REPORT] Range:', startOfDay, 'até', endOfDay);

      // Buscar todos os pagamentos e filtrar pela data
      const allPayments = await paymentsServiceOffline.getAllPayments();
      console.log('[CASH REPORT] Total de pagamentos no sistema:', allPayments.length);

      const dayPayments = allPayments.filter(p => {
        const paymentDate = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
        return paymentDate >= startOfDay && paymentDate <= endOfDay;
      });

      console.log('[CASH REPORT] Pagamentos do dia (antes do enriquecimento):', dayPayments.length);

      // Enriquecer pagamentos com nome da criança se estiver faltando
      const { customersServiceOffline } = await import('../../../shared/firebase/services/customers.service.offline');
      const allChildren = await customersServiceOffline.getAllChildren();
      
      const enrichedPayments = dayPayments.map(p => {
        // Se já tem childName, retorna como está
        if (p.childName && p.childName !== 'N/A') {
          return p;
        }
        
        // Se tem childId, busca o nome
        if (p.childId) {
          const child = allChildren.find(c => c.id === p.childId);
          if (child) {
            console.log('[CASH REPORT] Enriquecendo pagamento com nome:', child.name);
            return { ...p, childName: child.name };
          }
        }
        
        // Fallback: tenta extrair do description
        if (p.description) {
          const match = p.description.match(/- (.+?) -/);
          if (match) {
            return { ...p, childName: match[1] };
          }
        }
        
        return p;
      });

      console.log('[CASH REPORT] Pagamentos enriquecidos:', enrichedPayments.map(p => ({
        childName: p.childName,
        type: p.type,
        amount: p.amount,
      })));

      setPayments(enrichedPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'cash': 'DINHEIRO',
      'dinheiro': 'DINHEIRO',
      'pix': 'PIX',
      'card': 'CARTAO',
      'cartao': 'CARTAO',
      'package': 'PACOTE',
      'pacote': 'PACOTE',
    };
    return labels[method.toLowerCase()] || method.toUpperCase();
  };

  const getTypeLabel = (payment: Payment): 'PACOTE' | 'VISITA' => {
    return payment.type === 'package' ? 'PACOTE' : 'VISITA';
  };

  // Totais
  const totalPackages = payments
    .filter(p => p.type === 'package')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalVisits = payments
    .filter(p => p.type === 'visit')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalGeneral = payments.reduce((sum, p) => sum + p.amount, 0);

  // Por método de pagamento
  const totalByMethod = {
    dinheiro: payments.filter(p => ['cash', 'dinheiro'].includes(p.method.toLowerCase())).reduce((sum, p) => sum + p.amount, 0),
    pix: payments.filter(p => p.method.toLowerCase() === 'pix').reduce((sum, p) => sum + p.amount, 0),
    cartao: payments.filter(p => ['card', 'cartao'].includes(p.method.toLowerCase())).reduce((sum, p) => sum + p.amount, 0),
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);

      // Carregar configurações fiscais
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig();
      
      if (!fiscalConfig?.enableFiscalPrint) {
        toast.warning('Impressão não configurada. Gerando visualização...');
        printToConsole();
        return;
      }

      // Import dinâmico para evitar problemas de inicialização
      const { bematechService } = await import('../../../shared/services/bematech.service');

      // Inicializar impressora
      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) {
        toast.warning('Impressora não disponível. Gerando visualização...');
        printToConsole();
        return;
      }

      // Montar relatório
      const dateFormatted = format(new Date(selectedDate), "dd/MM/yyyy", { locale: ptBR });
      const lines: string[] = [
        '================================',
        `  RELATORIO DE CAIXA`,
        `  ${dateFormatted}`,
        '================================',
        '',
      ];

      // Listar pagamentos
      payments.forEach(p => {
        const name = (p.childName || 'N/A').substring(0, 12).padEnd(12);
        const type = getTypeLabel(p).padEnd(7);
        const method = getPaymentMethodLabel(p.method).substring(0, 8).padEnd(8);
        const amount = `R$ ${p.amount.toFixed(2)}`;
        lines.push(`${name} ${type} ${method} ${amount}`);
      });

      lines.push('');
      lines.push('================================');
      lines.push(`TOTAL PACOTES:  R$ ${totalPackages.toFixed(2)}`);
      lines.push(`TOTAL VISITAS:  R$ ${totalVisits.toFixed(2)}`);
      lines.push('--------------------------------');
      lines.push(`DINHEIRO:       R$ ${totalByMethod.dinheiro.toFixed(2)}`);
      lines.push(`PIX:            R$ ${totalByMethod.pix.toFixed(2)}`);
      lines.push(`CARTAO:         R$ ${totalByMethod.cartao.toFixed(2)}`);
      lines.push('================================');
      lines.push(`TOTAL GERAL:    R$ ${totalGeneral.toFixed(2)}`);
      lines.push('================================');
      lines.push('');
      lines.push(`Impresso: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);

      // bematechService já foi importado dinamicamente acima
      const success = await bematechService.printNonFiscalReport('RELATORIO DE CAIXA', lines);
      
      if (success) {
        toast.success('✅ Relatório impresso com sucesso!');
      } else {
        toast.warning('Impressão falhou. Verifique a impressora.');
        printToConsole();
      }
    } catch (error) {
      console.error('Error printing report:', error);
      toast.error('Erro ao imprimir relatório');
    } finally {
      setPrinting(false);
    }
  };

  const printToConsole = () => {
    const dateFormatted = format(new Date(selectedDate), "dd/MM/yyyy", { locale: ptBR });
    console.log('================================');
    console.log(`  RELATÓRIO DE CAIXA - ${dateFormatted}`);
    console.log('================================');
    payments.forEach(p => {
      console.log(`${p.childName || 'N/A'} | ${getTypeLabel(p)} | ${getPaymentMethodLabel(p.method)} | R$ ${p.amount.toFixed(2)}`);
    });
    console.log('================================');
    console.log(`TOTAL PACOTES: R$ ${totalPackages.toFixed(2)}`);
    console.log(`TOTAL VISITAS: R$ ${totalVisits.toFixed(2)}`);
    console.log(`TOTAL GERAL: R$ ${totalGeneral.toFixed(2)}`);
    console.log('================================');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📊 Relatório de Caixa</h1>
          <p className="text-gray-500">Fechamento diário com impressão</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing || payments.length === 0}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
        >
          {printing ? '⏳ Imprimindo...' : '🖨️ Imprimir Relatório'}
        </button>
      </div>

      {/* Seletor de Data */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <label className="block text-sm font-bold text-gray-700 mb-3">
          📅 Selecione a Data
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full md:w-auto px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
        />
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-5">
          <p className="text-purple-100 text-sm font-medium mb-1">📦 Pacotes</p>
          <p className="text-3xl font-bold">R$ {totalPackages.toFixed(2)}</p>
          <p className="text-purple-200 text-sm mt-1">
            {payments.filter(p => p.type === 'package').length} vendas
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-5">
          <p className="text-blue-100 text-sm font-medium mb-1">🎫 Visitas</p>
          <p className="text-3xl font-bold">R$ {totalVisits.toFixed(2)}</p>
          <p className="text-blue-200 text-sm mt-1">
            {payments.filter(p => p.type === 'visit').length} visitas
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-5">
          <p className="text-green-100 text-sm font-medium mb-1">💰 Total Geral</p>
          <p className="text-3xl font-bold">R$ {totalGeneral.toFixed(2)}</p>
          <p className="text-green-200 text-sm mt-1">{payments.length} pagamentos</p>
        </div>
        <div className="bg-gradient-to-br from-gray-600 to-gray-700 text-white rounded-xl shadow-lg p-5">
          <p className="text-gray-300 text-sm font-medium mb-1">📊 Por Método</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>💵 Dinheiro:</span>
              <span className="font-bold">R$ {totalByMethod.dinheiro.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>📱 PIX:</span>
              <span className="font-bold">R$ {totalByMethod.pix.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>💳 Cartão:</span>
              <span className="font-bold">R$ {totalByMethod.cartao.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Pagamentos */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            📋 Detalhamento - {format(new Date(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <button
            onClick={loadPayments}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄'} Atualizar
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-4 border border-gray-200 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-6xl mb-4">📊</p>
            <p className="text-xl font-medium">Nenhum pagamento nesta data</p>
            <p className="text-sm mt-2">Selecione outra data ou aguarde novos pagamentos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 rounded-tl-lg font-bold text-gray-700">Nome</th>
                  <th className="text-left p-3 font-bold text-gray-700">Tipo</th>
                  <th className="text-left p-3 font-bold text-gray-700">Pagamento</th>
                  <th className="text-right p-3 rounded-tr-lg font-bold text-gray-700">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, index) => (
                  <tr
                    key={payment.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="p-3">
                      <span className="font-medium text-gray-800">
                        {payment.childName || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          payment.type === 'package'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {getTypeLabel(payment)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-gray-700">
                        {getPaymentMethodLabel(payment.method)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-green-600 text-lg">
                        R$ {payment.amount.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800 text-white">
                  <td colSpan={3} className="p-3 rounded-bl-lg font-bold">
                    TOTAL DO DIA
                  </td>
                  <td className="p-3 text-right rounded-br-lg font-bold text-2xl">
                    R$ {totalGeneral.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashReport;
