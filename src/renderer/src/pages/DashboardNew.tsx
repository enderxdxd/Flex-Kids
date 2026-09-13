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
import CheckOutModal from '../components/modals/CheckOutModal';
import CancelCheckInModal from '../components/modals/CancelCheckInModal';
import {
  TargetIcon, MoneyIcon, ChartIcon, PackageIcon, GamepadIcon,
  PlusIcon, UserPlusIcon, CreditCardIcon,
} from '../components/icons/Icons';
import {
  Card, Button, IconButton, StatCard, PageHeader, SectionHeader, EmptyState,
  Skeleton, Badge, Clock, ClockStripe, cn,
} from '../components/ui';
import { formatBRL } from '../../../shared/utils/currency';


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
      toast.error('Não foi possível carregar o painel. Verifique a conexão e recarregue a página.');
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
    <div className="min-h-screen bg-paper">
      <Navbar onRefresh={() => loadStats(true)} loading={loading} activeVisitsCount={activeVisits.length} />

      <main
        className="p-5 lg:p-6 space-y-4 transition-[margin] duration-200"
        style={{ marginLeft: 'var(--sidebar-w-current)' }}
      >
        <PageHeader
          title="Principal"
          subtitle={<>{unitInfo?.name} &middot; {dateLabel}</>}
          actions={
            <>
              {lastUpdated && (
                <span className="text-xs text-ink-400 hidden sm:inline">
                  Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                onClick={() => setShowCheckInModal(true)}
                size="md"
                iconLeft={<PlusIcon size={18} />}
              >
                Novo check-in
              </Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Visitas Ativas"
            value={stats.activeVisits}
            icon={<TargetIcon size={20} />}
            tone="slate"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Receita Hoje"
            value={formatBRL(stats.todayRevenue)}
            icon={<MoneyIcon size={20} />}
            tone="emerald"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Total Visitas Hoje"
            value={stats.todayVisits}
            icon={<ChartIcon size={20} />}
            tone="slate"
            loading={loading && isInitialLoad}
          />
          <StatCard
            label="Pacotes Ativos"
            value={stats.activePackages}
            icon={<PackageIcon size={20} />}
            tone="slate"
            loading={loading && isInitialLoad}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Quem está dentro agora — o painel que o balcão olha o dia inteiro.
              Lê como painel de embarque: relógio mono alinhado, nome, e a
              faixa de estado só acende para quem passou do tempo. */}
          <Card padding="none" className="lg:col-span-2 overflow-hidden">
            <SectionHeader
              title="No espaço agora"
              count={activeVisits.length}
            />

            <div className="max-h-[560px] overflow-y-auto divide-y divide-line-subtle">
              {loading && isInitialLoad ? (
                <div className="p-3 space-y-1.5">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-row" />)}
                </div>
              ) : activeVisits.length === 0 ? (
                <EmptyState
                  icon={<GamepadIcon size={32} />}
                  title="Ninguém no espaço"
                  description="Registre um check-in para começar o turno"
                  action={
                    <Button size="sm" onClick={() => setShowCheckInModal(true)} iconLeft={<PlusIcon size={16} />}>
                      Novo check-in
                    </Button>
                  }
                />
              ) : (
                [...activeVisits]
                  .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                  .map((visit) => {
                    const elapsed = Math.max(0, Math.floor((now - new Date(visit.checkIn).getTime()) / 60000));
                    return (
                      <div key={visit.id} className="group flex items-center gap-3 pl-3 pr-3 py-2 hover:bg-paper transition-colors">
                        <ClockStripe minutes={elapsed} className="self-stretch my-0.5" />

                        <span className="font-mono text-xs text-ink-400 w-11 flex-shrink-0">
                          {new Date(visit.checkIn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-ink-900 truncate">{visit.child?.name || 'Criança'}</p>
                            {visit.kidsPlanId && <Badge tone="blue" size="sm">Kids</Badge>}
                          </div>
                          <p className="text-xs text-ink-400 truncate">
                            {visit.child?.customer?.name || 'Cliente'}
                            {visit.child?.customer?.phone ? ` · ${visit.child.customer.phone}` : ''}
                          </p>
                        </div>

                        <Clock minutes={elapsed} size="lg" className="flex-shrink-0 w-20 text-right" />

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <IconButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleCancelCheckIn(visit)}
                            aria-label={`Cancelar check-in de ${visit.child?.name || 'criança'}`}
                            title="Cancelar check-in"
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                            </svg>
                          </IconButton>
                          <Button size="sm" variant="outline" onClick={() => handleCheckOut(visit)}>
                            Check-out
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </Card>

          {/* Coluna de apoio */}
          <div className="space-y-4">
            <Card padding="none">
              <SectionHeader title="Ações rápidas" />
              <div className="p-2 space-y-0.5">
                <QuickAction
                  icon={<PlusIcon size={16} />}
                  label="Check-in"
                  description="Registrar entrada"
                  onClick={() => setShowCheckInModal(true)}
                />
                <QuickAction
                  icon={<UserPlusIcon size={16} />}
                  label="Novo cliente"
                  description="Cadastrar responsável"
                  onClick={() => setShowCustomerModal(true)}
                />
              </div>
            </Card>

            <Card padding="none">
              <SectionHeader title="Pagamentos de hoje" count={recentPayments.length} />
              <div className="max-h-[400px] overflow-y-auto divide-y divide-line-subtle">
                {recentPayments.length === 0 ? (
                  <EmptyState
                    icon={<CreditCardIcon size={28} />}
                    title="Nenhum pagamento hoje"
                    description="Os recebimentos do turno aparecem aqui"
                  />
                ) : (
                  recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper transition-colors">
                      <span className="font-mono text-xs text-ink-400 w-11 flex-shrink-0">
                        {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-ink-900 truncate">
                          {payment.childName || payment.description || 'Pagamento'}
                        </p>
                        <p className="text-xs text-ink-400 truncate">
                          {payment.type === 'package' ? 'Pacote' : 'Avulso'} · {getPaymentMethodLabel(payment.method)}
                        </p>
                      </div>
                      <p className="font-semibold text-sm text-money-in tabular-nums flex-shrink-0">
                        {formatBRL(payment.amount)}
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
  onClick: () => void;
}

/** Atalho de balcão. É um item de menu, não um cartão promocional. */
const QuickAction: React.FC<QuickActionProps> = ({ icon, label, description, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'group w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left',
      'transition-colors duration-100 hover:bg-brand-50',
      'focus-visible:outline-none focus-visible:shadow-focus',
    )}
  >
    <span className="w-7 h-7 rounded-md border border-line bg-paper-raised flex items-center justify-center flex-shrink-0 text-ink-500 group-hover:text-brand-600 group-hover:border-brand-200 transition-colors" aria-hidden="true">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-semibold text-sm text-ink-900">{label}</span>
      <span className="block text-xs text-ink-500">{description}</span>
    </span>
    <svg className="w-3.5 h-3.5 text-ink-300 group-hover:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

export default DashboardNew;
