import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Payment } from '../../../shared/types';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { settingsServiceOffline } from '../../../shared/firebase/services/settings.service.offline';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, Button, PageHeader, EmptyState, Skeleton, Badge, cn,
} from '../components/ui';
import { RefreshIcon, BarChartIcon } from '../components/icons/Icons';

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
        rangeEnd = new Date(year, month, 0);
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        const date = new Date(selectedDate + 'T00:00:00');
        rangeStart = new Date(date);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(date);
        rangeEnd.setHours(23, 59, 59, 999);
      }

      const allPayments = await paymentsServiceOffline.getAllPayments(currentUnit);

      const dayPayments = allPayments.filter(p => {
        const paymentDate = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
        const matchesDate = paymentDate >= rangeStart && paymentDate <= rangeEnd;
        const matchesUnit = p.unitId === currentUnit;
        return matchesDate && matchesUnit;
      });

      const { customersServiceOffline } = await import('../../../shared/firebase/services/customers.service.offline');
      const allChildren = await customersServiceOffline.getAllChildren(currentUnit);

      const enrichedPayments = dayPayments.map(p => {
        if (p.childName && p.childName !== 'N/A') return p;
        if (p.childId) {
          const child = allChildren.find(c => c.id === p.childId);
          if (child) return { ...p, childName: child.name };
        }
        if (p.description) {
          const match = p.description.match(/- (.+?) -/);
          if (match) return { ...p, childName: match[1] };
        }
        return p;
      });

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
      cash: 'DINHEIRO',
      dinheiro: 'DINHEIRO',
      pix: 'PIX',
      card: 'CARTAO',
      cartao: 'CARTAO',
      package: 'PACOTE',
      pacote: 'PACOTE',
    };
    return labels[method.toLowerCase()] || method.toUpperCase();
  };

  const getTypeLabel = (payment: Payment): 'PACOTE' | 'VISITA' => {
    return payment.type === 'package' ? 'PACOTE' : 'VISITA';
  };

  const totalPackages = payments.filter(p => p.type === 'package').reduce((sum, p) => sum + p.amount, 0);
  const totalVisits = payments.filter(p => p.type === 'visit').reduce((sum, p) => sum + p.amount, 0);
  const totalGeneral = payments.reduce((sum, p) => sum + p.amount, 0);

  const totalByMethod = {
    dinheiro: payments.filter(p => ['cash', 'dinheiro'].includes(p.method.toLowerCase())).reduce((sum, p) => sum + p.amount, 0),
    pix: payments.filter(p => p.method.toLowerCase() === 'pix').reduce((sum, p) => sum + p.amount, 0),
    cartao: payments.filter(p => ['card', 'cartao'].includes(p.method.toLowerCase())).reduce((sum, p) => sum + p.amount, 0),
  };

  const handlePrintNormal = () => window.print();

  const handlePrint = async () => {
    try {
      setPrinting(true);
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);

      if (!fiscalConfig?.enableFiscalPrint) {
        toast.warning('Impressão não configurada. Gerando visualização...');
        printToConsole();
        return;
      }

      const { bematechService } = await import('../../../shared/services/bematech.service');
      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) {
        toast.warning('Impressora não disponível. Gerando visualização...');
        printToConsole();
        return;
      }

      const dateFormatted = format(new Date(selectedDate), 'dd/MM/yyyy', { locale: ptBR });
      const lines: string[] = [
        '================================',
        '  RELATORIO DE CAIXA',
        `  ${dateFormatted}`,
        '================================',
        '',
      ];

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

      const success = await bematechService.printNonFiscalReport('RELATORIO DE CAIXA', lines);
      if (success) toast.success('Relatório impresso com sucesso!');
      else { toast.warning('Impressão falhou. Verifique a impressora.'); printToConsole(); }
    } catch (error) {
      console.error('Error printing report:', error);
      toast.error('Erro ao imprimir relatório');
    } finally {
      setPrinting(false);
    }
  };

  const printToConsole = () => {
    const dateFormatted = format(new Date(selectedDate), 'dd/MM/yyyy', { locale: ptBR });
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

  const MethodIcon: React.FC<{ method: string; className?: string }> = ({ method, className = 'w-4 h-4' }) => {
    const m = method.toLowerCase();
    if (m === 'pix') return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    if (['cash', 'dinheiro'].includes(m)) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    if (['card', 'cartao', 'credit', 'debit'].includes(m)) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>;
    if (['package', 'pacote'].includes(m)) return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 2" /></svg>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Caixa"
        subtitle={viewMode === 'daily' ? 'Fechamento diário' : 'Resumo mensal'}
        actions={
          <div className="flex gap-2 no-print">
            <Button
              variant="outline"
              onClick={handlePrintNormal}
              iconLeft={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                </svg>
              }
            >
              Imprimir
            </Button>
            <Button
              onClick={handlePrint}
              disabled={payments.length === 0}
              loading={printing}
              iconLeft={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            >
              Imprimir Fiscal
            </Button>
          </div>
        }
      />

      {/* Toggle + date */}
      <div className="flex flex-wrap items-center gap-4 no-print">
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['daily', 'monthly'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                viewMode === m
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'daily' ? 'Diário' : 'Mensal'}
            </button>
          ))}
        </div>

        {viewMode === 'daily' ? (
          <>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
            />
            <span className="text-sm text-slate-500 capitalize">
              {format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </>
        ) : (
          <>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
            />
            <span className="text-sm text-slate-500 capitalize">
              {format(new Date(selectedMonth + '-15'), "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-brand-50 to-fuchsia-50/50 border-brand-200/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </span>
            <p className="text-caption text-brand-700 uppercase">Pacotes</p>
          </div>
          <p className="text-2xl font-bold text-brand-700 tabular-nums">R$ {totalPackages.toFixed(2)}</p>
          <p className="text-[11px] text-brand-600/70 mt-1">{packageCount} {packageCount === 1 ? 'venda' : 'vendas'}</p>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-sky-50/50 border-blue-200/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <BarChartIcon size={14} />
            </span>
            <p className="text-caption text-blue-700 uppercase">Visitas</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 tabular-nums">R$ {totalVisits.toFixed(2)}</p>
          <p className="text-[11px] text-blue-600/70 mt-1">{visitCount} {visitCount === 1 ? 'visita' : 'visitas'}</p>
        </Card>

        <Card padding="md" accent className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <p className="text-caption text-emerald-700 uppercase">Total Geral</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">R$ {totalGeneral.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-600/70 mt-1">{payments.length} {payments.length === 1 ? 'pagamento' : 'pagamentos'}</p>
        </Card>

        <Card padding="md">
          <p className="text-caption text-slate-500 uppercase mb-3">Por Método</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <MethodIcon method="cash" className="w-3.5 h-3.5 text-emerald-600" /> Dinheiro
              </span>
              <span className={cn('text-xs font-bold tabular-nums', totalByMethod.dinheiro > 0 ? 'text-slate-900' : 'text-slate-300')}>R$ {totalByMethod.dinheiro.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <MethodIcon method="pix" className="w-3.5 h-3.5 text-amber-600" /> PIX
              </span>
              <span className={cn('text-xs font-bold tabular-nums', totalByMethod.pix > 0 ? 'text-slate-900' : 'text-slate-300')}>R$ {totalByMethod.pix.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <MethodIcon method="card" className="w-3.5 h-3.5 text-blue-600" /> Cartão
              </span>
              <span className={cn('text-xs font-bold tabular-nums', totalByMethod.cartao > 0 ? 'text-slate-900' : 'text-slate-300')}>R$ {totalByMethod.cartao.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/40 to-transparent no-print">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Detalhamento</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPayments}
            loading={loading}
            iconLeft={<RefreshIcon size={14} />}
          >
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<BarChartIcon size={28} />}
            title="Nenhum pagamento nesta data"
            description="Selecione outra data para ver o relatório"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="text-left px-5 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Método</th>
                  {viewMode === 'monthly' && <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Data</th>}
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Hora</th>
                  <th className="text-right px-5 py-3 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900">{payment.childName || payment.description || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={payment.type === 'package' ? 'brand' : 'emerald'} size="sm">
                        {getTypeLabel(payment)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <MethodIcon method={payment.method} className="w-3.5 h-3.5" />
                        {getPaymentMethodLabel(payment.method)}
                      </span>
                    </td>
                    {viewMode === 'monthly' && (
                      <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                        {new Date(payment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                      {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-700 tabular-nums">R$ {payment.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-slate-900 to-slate-800">
                  <td colSpan={viewMode === 'monthly' ? 5 : 4} className="px-5 py-3.5 font-bold text-sm text-white">{viewMode === 'daily' ? 'TOTAL DO DIA' : 'TOTAL DO MÊS'}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-lg text-emerald-300 tabular-nums">R$ {totalGeneral.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CashReport;
