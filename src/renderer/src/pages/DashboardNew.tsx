import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { DashboardStats, Visit, Payment } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import CheckInModal from '../components/modals/CheckInModal';
import CustomerModal from '../components/modals/CustomerModal';
import PackageModal from '../components/modals/PackageModal';
import CheckOutModal from '../components/modals/CheckOutModal';
import CancelCheckInModal from '../components/modals/CancelCheckInModal';
import {
  TargetIcon, MoneyIcon, ChartIcon, PackageIcon, GamepadIcon,
  PlusIcon, UserPlusIcon, CreditCardIcon, ShoppingCartIcon,
} from '../components/icons/Icons';
import {
  Card, Button, IconButton, StatCard, PageHeader, EmptyState,
  Skeleton, Badge, cn,
} from '../components/ui';

type TimeTone = 'emerald' | 'amber' | 'orange' | 'red';

const getTimeTone = (minutes: number): TimeTone => {
  if (minutes <= 60) return 'emerald';
  if (minutes <= 120) return 'amber';
  if (minutes <= 180) return 'orange';
  return 'red';
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const PaymentMethodIcon: React.FC<{ method: string }> = ({ method }) => {
  const cls = 'w-4 h-4';
  switch (method) {
    case 'pix':
      return <svg className={cn(cls, 'text-amber-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case 'credit':
    case 'debit':
      return <svg className={cn(cls, 'text-blue-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
    case 'cash':
      return <svg className={cn(cls, 'text-emerald-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    case 'package':
      return <svg className={cn(cls, 'text-brand-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    default:
      return <svg className={cn(cls, 'text-slate-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }
};

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'pix': return 'PIX';
    case 'credit': return 'Crédito';
    case 'debit': return 'Débito';
    case 'cash': return 'Dinheiro';
    case 'package': return 'Pacote';
    default: return method;
  }
};

const DashboardNew: React.FC = () => {
  const { currentUnit, getCurrentUnitInfo } = useUnit();
  const [stats, setStats] = useState<DashboardStats>({
    activeVisits: 0,
    todayRevenue: 0,
    todayVisits: 0,
    activePackages: 0,
  });
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const loadingRef = useRef(false);
  const [now, setNow] = useState(Date.now());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const tickInterval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tickInterval);
  }, []);

  const loadStats = useCallback(async (showLoader = true) => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      if (showLoader) setLoading(true);

      const [visits, allVisits, payments, packages] = await Promise.all([
        visitsServiceOffline.getActiveVisits(currentUnit),
        visitsServiceOffline.getAllVisits(currentUnit),
        paymentsServiceOffline.getTodayPayments(currentUnit),
        packagesServiceOffline.getActivePackages(undefined, currentUnit),
      ]);

      const unitPayments = payments;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayVisitsCount = allVisits.filter(v => {
        const checkIn = v.checkIn instanceof Date ? v.checkIn : new Date(v.checkIn);
        return checkIn >= todayStart;
      }).length;

      setActiveVisits(visits);
      setRecentPayments(unitPayments.slice(0, 5));

      const todayRevenue = unitPayments.reduce((sum, p) => sum + p.amount, 0);

      setStats({
        activeVisits: visits.length,
        todayRevenue,
        todayVisits: todayVisitsCount,
        activePackages: packages.length,
      });
      setLastUpdated(new Date());
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [currentUnit]);

  useEffect(() => {
    loadStats(true);

    const intervalId = setInterval(() => {
      loadStats(false);
    }, 15000);

    const handleFocus = () => loadStats(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadStats(false);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadStats]);

  const handleCheckOut = (visit: Visit) => {
    setSelectedVisit(visit);
    setShowCheckOutModal(true);
  };

  const handleCancelCheckIn = (visit: Visit) => {
    setSelectedVisit(visit);
    setShowCancelModal(true);
  };

  const handleCheckOutSuccess = () => {
    setShowCheckOutModal(false);
    setSelectedVisit(null);
    loadStats(true);
  };

  const handleCancelSuccess = () => {
    setShowCancelModal(false);
    setSelectedVisit(null);
    loadStats(true);
  };

  const unitInfo = getCurrentUnitInfo();
  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onRefresh={() => loadStats(true)} loading={loading} activeVisitsCount={activeVisits.length} />

      <main
        className="p-6 lg:p-8 space-y-6 transition-[margin] duration-200"
        style={{ marginLeft: 'var(--sidebar-w-current)' }}
      >
        <PageHeader
          title="Principal"
          subtitle={<>{unitInfo?.name} &middot; {dateLabel}</>}
          actions={
            <>
              {lastUpdated && (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                onClick={() => setShowCheckInModal(true)}
                size="md"
                iconLeft={<PlusIcon size={18} />}
              >
                Novo Check-In
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Visitas Ativas"
            value={stats.activeVisits}
            icon={<TargetIcon size={20} />}
            tone="blue"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Receita Hoje"
            value={`R$ ${stats.todayRevenue.toFixed(2)}`}
            icon={<MoneyIcon size={20} />}
            tone="emerald"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Total Visitas Hoje"
            value={stats.todayVisits}
            icon={<ChartIcon size={20} />}
            tone="brand"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Pacotes Ativos"
            value={stats.activePackages}
            icon={<PackageIcon size={20} />}
            tone="amber"
            loading={loading && isInitialLoad}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visitas Ativas */}
          <Card padding="none" accent className="lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-brand-50/50 to-transparent">
              <h2 className="text-heading bg-brand-gradient bg-clip-text text-transparent">Visitas Ativas</h2>
              <Badge tone="brand">{activeVisits.length}</Badge>
            </div>

            <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
              {loading && isInitialLoad ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : activeVisits.length === 0 ? (
                <EmptyState
                  icon={<GamepadIcon size={28} />}
                  title="Nenhuma visita ativa"
                  description="Faça um check-in para começar"
                />
              ) : (
                [...activeVisits]
                  .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                  .map((visit) => {
                    const elapsed = Math.max(0, Math.floor((now - new Date(visit.checkIn).getTime()) / 60000));
                    const tone = getTimeTone(elapsed);
                    const stripeColor = tone === 'emerald' ? 'bg-gradient-to-b from-emerald-400 to-teal-500'
                      : tone === 'amber' ? 'bg-gradient-to-b from-amber-400 to-orange-400'
                      : tone === 'orange' ? 'bg-gradient-to-b from-orange-400 to-red-400'
                      : 'bg-gradient-to-b from-red-500 to-rose-600';
                    const hoverBg = tone === 'emerald' ? 'hover:bg-emerald-50/40'
                      : tone === 'amber' ? 'hover:bg-amber-50/40'
                      : tone === 'orange' ? 'hover:bg-orange-50/40'
                      : 'hover:bg-red-50/40';

                    return (
                      <div key={visit.id} className={cn('relative flex items-center gap-3 pl-5 pr-5 py-3 transition-colors', hoverBg)}>
                        <div className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-r-full', stripeColor)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 truncate">{visit.child?.name || 'Criança'}</p>
                            {visit.kidsPlanId && <Badge tone="blue" size="sm">Kids</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="tabular-nums">
                              {new Date(visit.checkIn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-300">·</span>
                            <Badge tone={tone} size="sm">{formatDuration(elapsed)}</Badge>
                            <span className="text-slate-300">·</span>
                            <span className="truncate text-slate-400">
                              {visit.child?.customer?.name || 'Cliente'}
                              {visit.child?.customer?.phone ? ` · ${visit.child.customer.phone}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <IconButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancelCheckIn(visit)}
                            aria-label="Cancelar check-in"
                            title="Cancelar check-in"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 6L6 18" />
                              <path d="M6 6l12 12" />
                            </svg>
                          </IconButton>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleCheckOut(visit)}
                          >
                            Check-Out
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ações Rápidas */}
            <Card padding="md" accent>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-brand-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <h2 className="text-heading bg-brand-gradient bg-clip-text text-transparent">Ações Rápidas</h2>
              </div>
              <div className="space-y-2">
                <QuickAction
                  icon={<PlusIcon size={18} />}
                  label="Check-In"
                  description="Registrar entrada"
                  tone="emerald"
                  onClick={() => setShowCheckInModal(true)}
                />
                <QuickAction
                  icon={<UserPlusIcon size={18} />}
                  label="Novo Cliente"
                  description="Cadastrar responsável"
                  tone="blue"
                  onClick={() => setShowCustomerModal(true)}
                />
                <QuickAction
                  icon={<ShoppingCartIcon size={18} />}
                  label="Vender Pacote"
                  description="Pacote de horas"
                  tone="amber"
                  onClick={() => setShowPackageModal(true)}
                />
              </div>
            </Card>

            {/* Pagamentos Recentes */}
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-transparent">
                <h2 className="text-heading text-slate-900">Pagamentos Recentes</h2>
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-sm">
                  <CreditCardIcon size={16} />
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                {recentPayments.length === 0 ? (
                  <EmptyState
                    icon={<CreditCardIcon size={24} />}
                    title="Nenhum pagamento hoje"
                    description="Os pagamentos aparecerão aqui"
                  />
                ) : (
                  recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <PaymentMethodIcon method={payment.method} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {payment.childName || payment.description || 'Pagamento'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="tabular-nums">
                            {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-300">·</span>
                          <Badge tone={payment.type === 'package' ? 'brand' : 'emerald'} size="sm">
                            {payment.type === 'package' ? 'Pacote' : 'Avulso'}
                          </Badge>
                          <span className="text-slate-300">·</span>
                          <span>{getPaymentMethodLabel(payment.method)}</span>
                        </div>
                      </div>
                      <p className="font-bold text-sm text-emerald-600 tabular-nums flex-shrink-0">
                        R$ {payment.amount.toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Modais */}
      <CheckInModal
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        onSuccess={() => loadStats(true)}
      />

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSuccess={() => loadStats(true)}
      />

      <PackageModal
        isOpen={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSuccess={() => loadStats(true)}
      />

      {selectedVisit && (
        <CheckOutModal
          isOpen={showCheckOutModal}
          onClose={() => {
            setShowCheckOutModal(false);
            setSelectedVisit(null);
          }}
          onSuccess={handleCheckOutSuccess}
          visit={selectedVisit}
          activeVisits={activeVisits}
        />
      )}

      {selectedVisit && (
        <CancelCheckInModal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedVisit(null);
          }}
          onSuccess={handleCancelSuccess}
          visit={selectedVisit}
        />
      )}
    </div>
  );
};

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  tone: 'emerald' | 'blue' | 'amber';
  onClick: () => void;
}

const quickActionTone: Record<QuickActionProps['tone'], {
  bg: string;
  iconBg: string;
  hoverBorder: string;
  arrow: string;
}> = {
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50/60',
    iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    hoverBorder: 'hover:border-emerald-300',
    arrow: 'text-emerald-500',
  },
  blue: {
    bg: 'bg-gradient-to-br from-sky-50 to-blue-50/60',
    iconBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
    hoverBorder: 'hover:border-blue-300',
    arrow: 'text-blue-500',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50/60',
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    hoverBorder: 'hover:border-amber-300',
    arrow: 'text-amber-500',
  },
};

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, description, tone, onClick }) => {
  const t = quickActionTone[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-3 p-3 rounded-xl text-left',
        'border border-slate-200/70 transition-all duration-200',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        t.bg,
        t.hoverBorder,
      )}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm group-hover:scale-110 transition-transform duration-200', t.iconBg)} aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-900">{label}</p>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      <svg className={cn('w-4 h-4 transition-transform group-hover:translate-x-0.5', t.arrow)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

export default DashboardNew;
