import React, { useEffect, useState } from 'react';
import { formatBRL } from '../../../shared/utils/currency';
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
    <div className="space-y-4">
      <PageHeader
        title="Caixa"
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
              Imprimir fiscal
            </Button>
          </div>
        }
      />

      {/* Toggle + date */}
      <div className="flex flex-wrap items-center gap-4 no-print">
        <div className="flex gap-5 border-b border-line" role="tablist">
          {(['daily', 'monthly'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors',
                'focus-visible:outline-none focus-visible:shadow-focus',
                viewMode === m
                  ? 'border-brand-600 text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-800',
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
              className="h-10 px-3 border border-line rounded-lg text-sm bg-paper-raised hover:border-brand-300 focus:border-brand-500 focus-visible:shadow-focus focus:outline-none transition-all"
            />
            <span className="text-sm text-ink-500 capitalize">
              {format(new Date(selectedDate + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </>
        ) : (
          <>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 px-3 border border-line rounded-lg text-sm bg-paper-raised hover:border-brand-300 focus:border-brand-500 focus-visible:shadow-focus focus:outline-none transition-all"
            />
            <span className="text-sm text-ink-500 capitalize">
              {format(new Date(selectedMonth + '-15'), "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </>
        )}
      </div>

      {/* Resumo do período. Três recortes do mesmo dinheiro: só o total geral
          recebe cor, porque é o número que fecha o caixa. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card padding="none" className="px-4 py-3.5">
          <p className="text-caption uppercase text-ink-500">Pacotes</p>
          <p className="text-readout text-ink-900 mt-1.5 tabular-nums">{formatBRL(totalPackages)}</p>
          <p className="text-xs text-ink-500 mt-0.5">{packageCount} {packageCount === 1 ? 'venda' : 'vendas'}</p>
        </Card>

        <Card padding="none" className="px-4 py-3.5">
          <p className="text-caption uppercase text-ink-500">Visitas</p>
          <p className="text-readout text-ink-900 mt-1.5 tabular-nums">{formatBRL(totalVisits)}</p>
          <p className="text-xs text-ink-500 mt-0.5">{visitCount} {visitCount === 1 ? 'visita' : 'visitas'}</p>
        </Card>

        <Card padding="none" className="px-4 py-3.5 border-money-in/30 bg-transparent">
          <p className="text-caption uppercase text-money-in">Total geral</p>
          <p className="text-readout text-money-in mt-1.5 tabular-nums">{formatBRL(totalGeneral)}</p>
          <p className="text-xs text-ink-500 mt-0.5">{payments.length} {payments.length === 1 ? 'pagamento' : 'pagamentos'}</p>
        </Card>

        <Card padding="none" className="px-4 py-3.5">
          <p className="text-caption uppercase text-ink-500 mb-2">Por método</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <MethodIcon method="cash" className="w-3.5 h-3.5 text-ink-400" /> Dinheiro
              </span>
              <span className={cn('text-xs font-semibold tabular-nums', totalByMethod.dinheiro > 0 ? 'text-ink-900' : 'text-ink-300')}>{formatBRL(totalByMethod.dinheiro)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <MethodIcon method="pix" className="w-3.5 h-3.5 text-ink-400" /> PIX
              </span>
              <span className={cn('text-xs font-semibold tabular-nums', totalByMethod.pix > 0 ? 'text-ink-900' : 'text-ink-300')}>{formatBRL(totalByMethod.pix)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <MethodIcon method="card" className="w-3.5 h-3.5 text-blue-600" /> Cartão
              </span>
              <span className={cn('text-xs font-semibold tabular-nums', totalByMethod.cartao > 0 ? 'text-ink-900' : 'text-ink-300')}>{formatBRL(totalByMethod.cartao)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="flex justify-between items-center px-5 py-4 border-b border-line-subtle bg-transparent no-print">
          <h2 className="text-caption uppercase text-ink-500">Detalhamento</h2>
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
                <tr className="border-b border-line bg-paper/60">
                  <th className="text-left px-5 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Método</th>
                  {viewMode === 'monthly' && <th className="text-left px-4 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Data</th>}
                  <th className="text-left px-4 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Hora</th>
                  <th className="text-right px-5 py-3 font-semibold text-[11px] text-ink-500 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink-900">{payment.childName || payment.description || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={payment.type === 'package' ? 'brand' : 'emerald'} size="sm">
                        {getTypeLabel(payment)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-ink-700">
                        <MethodIcon method={payment.method} className="w-3.5 h-3.5" />
                        {getPaymentMethodLabel(payment.method)}
                      </span>
                    </td>
                    {viewMode === 'monthly' && (
                      <td className="px-4 py-3 text-ink-500 text-xs tabular-nums">
                        {new Date(payment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </td>
                    )}
                    <td className="px-4 py-3 text-ink-500 tabular-nums">
                      {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-state-ok tabular-nums">{formatBRL(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-slate-900 to-slate-800">
                  <td colSpan={viewMode === 'monthly' ? 5 : 4} className="px-5 py-3.5 font-bold text-sm text-white">{viewMode === 'daily' ? 'TOTAL DO DIA' : 'TOTAL DO MÊS'}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-lg text-[#5fd3a3] tabular-nums">{formatBRL(totalGeneral)}</td>
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
