import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format, differenceInDays } from 'date-fns';
import { KidsPlan, Child, Customer } from '../../../shared/types';
import { kidsPlansServiceOffline } from '../../../shared/firebase/services/kidsPlans.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { useUnit } from '../contexts/UnitContext';

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

      // Auto-update status based on dates
      const now = new Date();
      const updatedPlans = allPlans.map(p => {
        const endDate = p.endDate instanceof Date ? p.endDate : new Date(p.endDate);
        const daysLeft = differenceInDays(endDate, now);
        let status = p.status;
        if (status !== 'cancelled') {
          if (daysLeft < 0) {
            status = 'expired';
          } else if (daysLeft <= 30) {
            status = 'expiring';
          } else {
            status = 'active';
          }
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
      case 'active':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Ativo</span>;
      case 'expiring':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">A vencer</span>;
      case 'expired':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Expirado</span>;
      case 'cancelled':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Cancelado</span>;
      default:
        return null;
    }
  };

  const getPlanTypeBadge = (type: string) => {
    switch (type) {
      case 'KIDS_2X':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">2X</span>;
      case 'KIDS_FULL':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">FULL</span>;
      default:
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{type}</span>;
    }
  };

  const getDaysLeft = (endDate: Date) => {
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    return differenceInDays(end, new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Plano Kids</h1>
          <p className="text-sm text-slate-500">{plans.length} planos cadastrados</p>
        </div>
        <button onClick={loadData} disabled={loading} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {loading ? '⏳' : '🔄'} Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
          <p className="text-xs text-slate-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{plans.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}>
          <p className="text-xs text-emerald-600 font-medium">Ativos</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{statsActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterStatus(filterStatus === 'expiring' ? 'all' : 'expiring')}>
          <p className="text-xs text-amber-600 font-medium">A Vencer</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{statsExpiring}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterStatus(filterStatus === 'expired' ? 'all' : 'expired')}>
          <p className="text-xs text-red-600 font-medium">Expirados</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{statsExpired}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterType(filterType === 'KIDS_2X' ? 'all' : 'KIDS_2X')}>
          <p className="text-xs text-blue-600 font-medium">2X Semana</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats2x}</p>
        </div>
        <div className="bg-white rounded-xl border border-violet-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterType(filterType === 'KIDS_FULL' ? 'all' : 'KIDS_FULL')}>
          <p className="text-xs text-violet-600 font-medium">Full</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{statsFull}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, matrícula ou contrato..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-400"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">Todos os planos</option>
            <option value="KIDS_2X">Plano Kids 2X</option>
            <option value="KIDS_FULL">Plano Kids Full</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">Todos os coaches</option>
              {coaches.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            Planos ({filteredPlans.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg" />)}
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="font-medium">Nenhum plano encontrado</p>
            {plans.length === 0 && <p className="text-xs mt-1">Importe os dados na página de Importação</p>}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPlans.map((plan) => {
              const daysLeft = getDaysLeft(plan.endDate);
              const startDate = plan.startDate instanceof Date ? plan.startDate : new Date(plan.startDate);
              const endDate = plan.endDate instanceof Date ? plan.endDate : new Date(plan.endDate);

              return (
                <div key={plan.id} className={`p-4 hover:bg-slate-50 transition-colors ${plan.status === 'expired' || plan.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${plan.planType === 'KIDS_FULL' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                        <span className="text-lg">{plan.planType === 'KIDS_FULL' ? '🌟' : '📅'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">{getChildName(plan)}</p>
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
                      {/* Period */}
                      <div className="hidden md:block text-right">
                        <p className="text-xs text-slate-500">
                          {format(startDate, 'dd/MM/yy')} → {format(endDate, 'dd/MM/yy')}
                        </p>
                        <p className={`text-[11px] font-semibold ${daysLeft < 0 ? 'text-red-500' : daysLeft <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {daysLeft < 0 ? `Expirado há ${Math.abs(daysLeft)} dias` : `${daysLeft} dias restantes`}
                        </p>
                      </div>

                      {/* Value */}
                      <div className="text-right hidden lg:block">
                        <p className="text-sm font-bold text-slate-800">R$ {plan.monthlyValue.toFixed(2)}/mês</p>
                        {plan.totalValue > 0 && (
                          <p className="text-[10px] text-slate-400">Total: R$ {plan.totalValue.toFixed(2)}</p>
                        )}
                      </div>

                      {/* Duration */}
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
      </div>
    </div>
  );
};

export default KidsPlans;
