import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payment } from '../../../shared/types';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { useUnit } from '../contexts/UnitContext';

type ViewMode = 'daily' | 'monthly';

const CashReport: React.FC = () => {
  const { currentUnit } = useUnit();
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [selectedDate, selectedMonth, viewMode, currentUnit]);

  const loadPayments = async () => {
    try {
      setLoading(true);

      let rangeStart: Date;
      let rangeEnd: Date;

      if (viewMode === 'monthly') {
        const [year, month] = selectedMonth.split('-').map(Number);
        rangeStart = new Date(year, month - 1, 1);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(year, month, 0); // last day of month
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        const date = new Date(selectedDate + 'T00:00:00');
        rangeStart = new Date(date);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(date);
        rangeEnd.setHours(23, 59, 59, 999);
      }

      console.log(`[CASH REPORT] Mode: ${viewMode}, Range:`, rangeStart, 'até', rangeEnd);

      const allPayments = await paymentsServiceOffline.getAllPayments(currentUnit);

      const dayPayments = allPayments.filter(p => {
        const paymentDate = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
        const matchesDate = paymentDate >= rangeStart && paymentDate <= rangeEnd;
        const matchesUnit = p.unitId === currentUnit;
        return matchesDate && matchesUnit;
      });

      console.log('[CASH REPORT] Pagamentos do dia (antes do enriquecimento):', dayPayments.length);

      // Enriquecer pagamentos com nome da criança se estiver faltando
      const { customersServiceOffline } = await import('../../../shared/firebase/services/customers.service.offline');
      const allChildren = await customersServiceOffline.getAllChildren(currentUnit);
      
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
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);
      
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

  const packageCount = payments.filter(p => p.type === 'package').length;
  const visitCount = payments.filter(p => p.type === 'visit').length;

  const getMethodIcon = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'pix') return '⚡';
    if (['cash', 'dinheiro'].includes(m)) return '💵';
    if (['card', 'cartao', 'credit', 'debit'].includes(m)) return '💳';
    if (['package', 'pacote'].includes(m)) return '📦';
    return '💰';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatório de Caixa</h1>
          <p className="text-sm text-slate-500">{viewMode === 'daily' ? 'Fechamento diário' : 'Resumo mensal'}</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handlePrintNormal} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir
          </button>
          <button onClick={handlePrint} disabled={printing || payments.length === 0} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2">
            {printing ? (
              <><span className="animate-spin">⏳</span> Imprimindo...</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Imprimir Fiscal</>
            )}
          </button>
        </div>
      </div>

      {/* View Mode Toggle + Date Picker */}
      <div className="flex items-center gap-4 no-print">
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'daily' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Diário
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'monthly' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Mensal
          </button>
        </div>

        {viewMode === 'daily' ? (
          <>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">📅</span>
            </div>
            <span className="text-sm text-slate-500 capitalize">{format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          </>
        ) : (
          <>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition-all hover:border-slate-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">📅</span>
            </div>
            <span className="text-sm text-slate-500 capitalize">{format(new Date(selectedMonth + '-15'), "MMMM 'de' yyyy", { locale: ptBR })}</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pacotes */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 p-5 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📦</span>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Pacotes</p>
          </div>
          <p className={`text-2xl font-bold ${totalPackages > 0 ? 'bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent' : 'text-slate-300'}`}>R$ {totalPackages.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{packageCount} {packageCount === 1 ? 'venda' : 'vendas'}</p>
        </div>

        {/* Visitas */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 p-5 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎮</span>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Visitas</p>
          </div>
          <p className={`text-2xl font-bold ${totalVisits > 0 ? 'bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent' : 'text-slate-300'}`}>R$ {totalVisits.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{visitCount} {visitCount === 1 ? 'visita' : 'visitas'}</p>
        </div>

        {/* Total Geral - Destaque */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 backdrop-blur-xl rounded-2xl border border-emerald-200/50 p-5 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">💰</span>
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-wide">Total Geral</p>
          </div>
          <p className={`text-2xl font-bold ${totalGeneral > 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent' : 'text-slate-300'}`}>R$ {totalGeneral.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-500 mt-1">{payments.length} {payments.length === 1 ? 'pagamento' : 'pagamentos'}</p>
        </div>

        {/* Por Método */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 p-5 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Por Método</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span>💵</span> Dinheiro</span>
              <span className={`text-xs font-bold ${totalByMethod.dinheiro > 0 ? 'text-slate-800' : 'text-slate-300'}`}>R$ {totalByMethod.dinheiro.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span>⚡</span> PIX</span>
              <span className={`text-xs font-bold ${totalByMethod.pix > 0 ? 'text-slate-800' : 'text-slate-300'}`}>R$ {totalByMethod.pix.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span>💳</span> Cartão</span>
              <span className={`text-xs font-bold ${totalByMethod.cartao > 0 ? 'text-slate-800' : 'text-slate-300'}`}>R$ {totalByMethod.cartao.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 no-print">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Detalhamento</h2>
          <button onClick={loadPayments} disabled={loading} className="text-xs text-violet-600 hover:text-violet-700 font-semibold disabled:opacity-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-slate-100/50 rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-sm font-semibold text-slate-500">Nenhum pagamento nesta data</p>
            <p className="text-xs text-slate-400 mt-1">Selecione outra data para ver o relatório</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Método</th>
                  {viewMode === 'monthly' && <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Data</th>}
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Hora</th>
                  <th className="text-right px-5 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-violet-50/30 transition-colors duration-150">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{payment.childName || payment.description || '-'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${payment.type === 'package' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {getTypeLabel(payment)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span className="text-xs">{getMethodIcon(payment.method)}</span>
                        {getPaymentMethodLabel(payment.method)}
                      </span>
                    </td>
                    {viewMode === 'monthly' && (
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {new Date(payment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">🕐</span>
                        {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">R$ {payment.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
                  <td colSpan={viewMode === 'monthly' ? 5 : 4} className="px-5 py-3.5 font-bold text-sm text-white">{viewMode === 'daily' ? 'TOTAL DO DIA' : 'TOTAL DO MÊS'}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-lg text-emerald-400">R$ {totalGeneral.toFixed(2)}</td>
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
