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

  const handlePrintNormal = () => {
    window.print();
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
          <h1 className="text-2xl font-bold text-slate-800">Relatório de Caixa</h1>
          <p className="text-sm text-slate-500">Fechamento diário</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrintNormal} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors no-print">
            🖨️ Imprimir
          </button>
          <button onClick={handlePrint} disabled={printing || payments.length === 0} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 no-print">
            {printing ? '⏳ Imprimindo...' : '🧾 Imprimir Fiscal'}
          </button>
        </div>
      </div>

      {/* Date + Summary */}
      <div className="flex items-center gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 no-print"
        />
        <span className="text-sm text-slate-500">{format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Pacotes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">R$ {totalPackages.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{payments.filter(p => p.type === 'package').length} vendas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Visitas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">R$ {totalVisits.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{payments.filter(p => p.type === 'visit').length} visitas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Total Geral</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">R$ {totalGeneral.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{payments.length} pagamentos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Por Método</p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Dinheiro</span><span className="font-semibold text-slate-800">R$ {totalByMethod.dinheiro.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">PIX</span><span className="font-semibold text-slate-800">R$ {totalByMethod.pix.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Cartão</span><span className="font-semibold text-slate-800">R$ {totalByMethod.cartao.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 no-print">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Detalhamento</h2>
          <button onClick={loadPayments} disabled={loading} className="text-sm text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50">
            {loading ? '⏳' : '🔄'} Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">📊</p>
            <p className="font-medium">Nenhum pagamento nesta data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-600">Nome</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Tipo</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Método</th>
                  <th className="text-left p-3 font-semibold text-slate-600">Hora</th>
                  <th className="text-right p-3 font-semibold text-slate-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-slate-800">{payment.childName || payment.description || '-'}</td>
                    <td className="p-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${payment.type === 'package' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                        {getTypeLabel(payment)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{getPaymentMethodLabel(payment.method)}</td>
                    <td className="p-3 text-slate-500">{new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">R$ {payment.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={4} className="p-3 font-bold text-sm">TOTAL DO DIA</td>
                  <td className="p-3 text-right font-bold text-lg">R$ {totalGeneral.toFixed(2)}</td>
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
