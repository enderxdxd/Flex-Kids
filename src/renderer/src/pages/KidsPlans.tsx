import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, differenceInDays } from 'date-fns';
import { KidsPlan, Child, Customer } from '../../../shared/types';
import { kidsPlansServiceOffline } from '../../../shared/firebase/services/kidsPlans.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { useUnit } from '../contexts/UnitContext';
import {
  Card, Button, PageHeader, EmptyState, Skeleton, Badge, Input, cn,
} from '../components/ui';
import { RefreshIcon, GraduationCapIcon } from '../components/icons/Icons';

const KidsPlans: React.FC = () => {
  const { currentUnit } = useUnit();
  const [plans, setPlans] = useState<KidsPlan[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'KIDS_2X' | 'KIDS_FULL'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [filterCoach, setFilterCoach] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPlans, allChildren, allCustomers] = await Promise.all([
        kidsPlansServiceOffline.getAllPlans(currentUnit),
        customersServiceOffline.getAllChildren(currentUnit),
        customersServiceOffline.getAllCustomers(currentUnit),
      ]);

      const now = new Date();
      const updatedPlans = allPlans.map(p => {
        const endDate = p.endDate instanceof Date ? p.endDate : new Date(p.endDate);
        const daysLeft = differenceInDays(endDate, now);
        let status = p.status;
        if (status !== 'cancelled') {
          if (daysLeft < 0) status = 'expired';
          else if (daysLeft <= 30) status = 'expiring';
          else status = 'active';
        }
        return { ...p, status } as KidsPlan;
      });

      setPlans(updatedPlans);
      setChildren(allChildren);
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading kids plans:', error);
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const getChildName = (plan: KidsPlan) => {
    const byId = children.find(c => c.id === plan.childId);
    if (byId) return byId.name;
    if (plan.enrollmentCode) {
      const byCode = children.find(c => c.enrollmentCode === plan.enrollmentCode);
      if (byCode) return byCode.name;
    }
    return plan.childName || '-';
  };
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || '-';

  const coaches = Array.from(new Set(plans.map(p => p.coach).filter(Boolean))) as string[];

  const filteredPlans = plans.filter(p => {
    if (filterType !== 'all' && p.planType !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterCoach !== 'all' && p.coach !== filterCoach) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const childName = getChildName(p).toLowerCase();
      const customerName = getCustomerName(p.customerId).toLowerCase();
      const contract = p.contractNumber?.toLowerCase() || '';
      const enrollment = p.enrollmentCode?.toLowerCase() || '';
      if (!childName.includes(term) && !customerName.includes(term) && !contract.includes(term) && !enrollment.includes(term)) {
        return false;
      }
    }
    return true;
  });

  const statsActive = plans.filter(p => p.status === 'active').length;
  const statsExpiring = plans.filter(p => p.status === 'expiring').length;
  const statsExpired = plans.filter(p => p.status === 'expired').length;
  const stats2x = plans.filter(p => p.planType === 'KIDS_2X').length;
  const statsFull = plans.filter(p => p.planType === 'KIDS_FULL').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge tone="emerald" size="sm">✓ Ativo</Badge>;
      case 'expiring': return <Badge tone="amber" size="sm">⚠ A vencer</Badge>;
      case 'expired': return <Badge tone="red" size="sm">✕ Expirado</Badge>;
      case 'cancelled': return <Badge tone="slate" size="sm">⊘ Cancelado</Badge>;
      default: return null;
    }
  };

  const getPlanTypeBadge = (type: string) => {
    switch (type) {
      case 'KIDS_2X': return <Badge tone="blue" size="sm">2X</Badge>;
      case 'KIDS_FULL': return <Badge tone="brand" size="sm">FULL</Badge>;
      default: return <Badge tone="slate" size="sm">{type}</Badge>;
    }
  };

  const getDaysLeft = (endDate: Date) => {
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    return differenceInDays(end, new Date());
  };

  const statCard = (label: string, value: number, tone: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' | 'brand', onClick?: () => void, active?: boolean) => {
    const toneMap: Record<string, { ring: string; text: string; bg: string }> = {
      slate: { ring: 'border-slate-200', text: 'text-slate-900', bg: 'bg-white' },
      emerald: { ring: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/40' },
      amber: { ring: 'border-amber-200', text: 'text-amber-700', bg: 'bg-gradient-to-br from-amber-50 to-orange-50/40' },
      red: { ring: 'border-red-200', text: 'text-red-700', bg: 'bg-gradient-to-br from-red-50 to-rose-50/40' },
      blue: { ring: 'border-blue-200', text: 'text-blue-700', bg: 'bg-gradient-to-br from-sky-50 to-blue-50/40' },
      brand: { ring: 'border-brand-200', text: 'text-brand-700', bg: 'bg-gradient-to-br from-brand-50 to-fuchsia-50/40' },
    };
    const t = toneMap[tone];
    const Comp = onClick ? 'button' : 'div';
    return (
      <Comp
        onClick={onClick}
        className={cn(
          'rounded-card-lg border p-4 transition-all duration-200 text-left',
          t.ring, t.bg,
          onClick && 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
          active && 'ring-2 ring-brand-400 shadow-brand-sm',
        )}
      >
        <p className={cn('text-caption uppercase', t.text)}>{label}</p>
        <p className={cn('text-2xl font-bold tabular-nums mt-1', t.text)}>{value}</p>
      </Comp>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plano Kids"
        subtitle={`${plans.length} planos cadastrados`}
        actions={
          <Button
            variant="outline"
            onClick={loadData}
            loading={loading}
            iconLeft={<RefreshIcon size={16} />}
          >
            Atualizar
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {statCard('Total', plans.length, 'slate')}
        {statCard('Ativos', statsActive, 'emerald', () => setFilterStatus(filterStatus === 'active' ? 'all' : 'active'), filterStatus === 'active')}
        {statCard('A Vencer', statsExpiring, 'amber', () => setFilterStatus(filterStatus === 'expiring' ? 'all' : 'expiring'), filterStatus === 'expiring')}
        {statCard('Expirados', statsExpired, 'red', () => setFilterStatus(filterStatus === 'expired' ? 'all' : 'expired'), filterStatus === 'expired')}
        {statCard('2X Semana', stats2x, 'blue', () => setFilterType(filterType === 'KIDS_2X' ? 'all' : 'KIDS_2X'), filterType === 'KIDS_2X')}
        {statCard('Full', statsFull, 'brand', () => setFilterType(filterType === 'KIDS_FULL' ? 'all' : 'KIDS_FULL'), filterType === 'KIDS_FULL')}
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, matrícula ou contrato..."
            iconLeft={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            }
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
          >
            <option value="all">Todos os planos</option>
            <option value="KIDS_2X">Plano Kids 2X</option>
            <option value="KIDS_FULL">Plano Kids Full</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
          >
            <option value="all">Todas as situações</option>
            <option value="active">Ativos</option>
            <option value="expiring">A vencer</option>
            <option value="expired">Expirados</option>
          </select>
          {coaches.length > 0 && (
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white hover:border-brand-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
            >
              <option value="all">Todos os coaches</option>
              {coaches.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Plans List */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/40 to-transparent">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Planos ({filteredPlans.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : filteredPlans.length === 0 ? (
          <EmptyState
            icon={<GraduationCapIcon size={28} />}
            title="Nenhum plano encontrado"
            description={plans.length === 0 ? 'Importe os dados na página de Importação' : 'Tente ajustar os filtros'}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPlans.map((plan) => {
              const daysLeft = getDaysLeft(plan.endDate);
              const startDate = plan.startDate instanceof Date ? plan.startDate : new Date(plan.startDate);
              const endDate = plan.endDate instanceof Date ? plan.endDate : new Date(plan.endDate);
              const stripe = plan.status === 'expired' || plan.status === 'cancelled'
                ? 'bg-gradient-to-b from-slate-300 to-slate-400'
                : plan.status === 'expiring'
                  ? 'bg-gradient-to-b from-amber-400 to-orange-400'
                  : plan.planType === 'KIDS_FULL'
                    ? 'bg-brand-gradient'
                    : 'bg-gradient-to-b from-sky-400 to-blue-600';

              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative pl-5 pr-4 py-4 hover:bg-slate-50 transition-colors',
                    (plan.status === 'expired' || plan.status === 'cancelled') && 'opacity-70',
                  )}
                >
                  <span className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full', stripe)} aria-hidden="true" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm',
                        plan.planType === 'KIDS_FULL'
                          ? 'bg-brand-gradient'
                          : 'bg-gradient-to-br from-sky-400 to-blue-600',
                      )}>
                        {plan.planType === 'KIDS_FULL' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{getChildName(plan)}</p>
                          {getPlanTypeBadge(plan.planType)}
                          {getStatusBadge(plan.status)}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {getCustomerName(plan.customerId)}
                          {plan.enrollmentCode ? ` · Mat: ${plan.enrollmentCode}` : ''}
                          {plan.contractNumber ? ` · Contrato: ${plan.contractNumber}` : ''}
                          {plan.coach ? ` · ${plan.coach}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0 ml-4">
                      <div className="hidden md:block text-right">
                        <p className="text-xs text-slate-500 tabular-nums">
                          {format(startDate, 'dd/MM/yy')} → {format(endDate, 'dd/MM/yy')}
                        </p>
                        <p className={cn(
                          'text-[11px] font-semibold',
                          daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-700' : 'text-emerald-700',
                        )}>
                          {daysLeft < 0 ? `Expirado há ${Math.abs(daysLeft)} dias` : `${daysLeft} dias restantes`}
                        </p>
                      </div>

                      <div className="text-right hidden lg:block">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">R$ {plan.monthlyValue.toFixed(2)}/mês</p>
                        {plan.totalValue > 0 && (
                          <p className="text-[10px] text-slate-400 tabular-nums">Total: R$ {plan.totalValue.toFixed(2)}</p>
                        )}
                      </div>

                      <div className="text-right hidden lg:block">
                        <p className="text-xs text-slate-500">{plan.durationMonths} {plan.durationMonths === 1 ? 'mês' : 'meses'}</p>
                      </div>
                    </div>
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

export default KidsPlans;
