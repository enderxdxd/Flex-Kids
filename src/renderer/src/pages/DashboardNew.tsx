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
import { TargetIcon, MoneyIcon, ChartIcon, PackageIcon, GamepadIcon, PlusIcon, UserPlusIcon, CreditCardIcon } from '../components/icons/Icons';

// Helper: color based on elapsed minutes
const getTimeColor = (minutes: number) => {
  if (minutes <= 60) return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-100' };
  if (minutes <= 120) return { bg: 'bg-amber-400', text: 'text-amber-600', light: 'bg-amber-100' };
  if (minutes <= 180) return { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-100' };
  return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100' };
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const getPaymentMethodIcon = (method: string) => {
  switch (method) {
    case 'pix': return '⚡';
    case 'credit': return '💳';
    case 'debit': return '💳';
    case 'cash': return '💵';
    case 'package': return '📦';
    default: return '💰';
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

  // Atualiza o relógio a cada 30s para mostrar duração em tempo real
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

      // Contar visitas de hoje (todas, não só ativas)
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
    
    // Auto-refresh a cada 15 segundos
    const intervalId = setInterval(() => {
      loadStats(false);
    }, 15000);

    // Recarregar quando o usuário volta à aba/janela
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

  const handleCheckOut = async (visit: Visit) => {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onRefresh={() => loadStats(true)} loading={loading} activeVisitsCount={activeVisits.length} />

      <div className="ml-[240px] p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Principal</h1>
            <p className="text-sm text-slate-500">{unitInfo?.name} &middot; {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadStats(true)}
                disabled={loading}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? '⏳' : '🔄'} Atualizar
              </button>
              {lastUpdated && (
                <span className="text-[11px] text-slate-400">
                  {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCheckInModal(true)}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <PlusIcon size={20} /> Novo Check-In
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-7 hover:shadow-2xl hover:border-blue-200 hover:scale-105 transition-all duration-300 group shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 animate-[pulse-slow_3s_ease-in-out_infinite]">
                <TargetIcon className="text-blue-600 group-hover:animate-[bounce-subtle_0.6s_ease-in-out]" size={28} />
              </div>
              {loading && isInitialLoad && <div className="animate-spin text-sm">⏳</div>}
            </div>
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Visitas Ativas</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mt-2">{stats.activeVisits}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-7 hover:shadow-2xl hover:border-emerald-200 hover:scale-105 transition-all duration-300 group shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 animate-[pulse-slow_3s_ease-in-out_infinite_0.5s]">
              <MoneyIcon className="text-emerald-600 group-hover:animate-[bounce-subtle_0.6s_ease-in-out]" size={28} />
            </div>
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Receita Hoje</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent mt-2">R$ {stats.todayRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-7 hover:shadow-2xl hover:border-violet-200 hover:scale-105 transition-all duration-300 group shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-violet-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 animate-[pulse-slow_3s_ease-in-out_infinite_1s]">
              <ChartIcon className="text-violet-600 group-hover:animate-[bounce-subtle_0.6s_ease-in-out]" size={28} />
            </div>
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Total Visitas Hoje</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-violet-700 bg-clip-text text-transparent mt-2">{stats.todayVisits}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-7 hover:shadow-2xl hover:border-amber-200 hover:scale-105 transition-all duration-300 group shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 animate-[pulse-slow_3s_ease-in-out_infinite_1.5s]">
              <PackageIcon className="text-amber-600 group-hover:animate-[bounce-subtle_0.6s_ease-in-out]" size={28} />
            </div>
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Pacotes Ativos</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent mt-2">{stats.activePackages}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visitas Ativas */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-7 shadow-lg">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-6">Visitas Ativas</h2>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {loading && isInitialLoad ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="relative overflow-hidden bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 rounded-xl p-5 animate-pulse">
                    <div className="h-6 bg-slate-200 rounded-lg w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-200 rounded-lg w-1/2"></div>
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
                  </div>
                ))
              ) : activeVisits.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-[pulse-slow_3s_ease-in-out_infinite]">
                    <GamepadIcon className="text-slate-400" size={48} />
                  </div>
                  <p className="text-lg font-bold text-slate-700 mb-2">Nenhuma visita ativa</p>
                  <p className="text-sm text-slate-500">Faça um check-in para começar</p>
                </div>
              ) : (
                [...activeVisits]
                .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                .map((visit) => {
                  const elapsed = Math.max(0, Math.floor((now - new Date(visit.checkIn).getTime()) / 60000));
                  const colors = getTimeColor(elapsed);
                  return (
                  <div key={visit.id} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/50 hover:border-violet-200 hover:shadow-xl transition-all duration-300 group shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 ${colors.light} rounded-full flex items-center justify-center flex-shrink-0`}>
                          <span className="text-base">🧒</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800 truncate">{visit.child?.name || 'Criança'}</p>
                            {visit.kidsPlanId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Kids</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <span className="text-slate-400">🕐</span>
                              {new Date(visit.checkIn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`${colors.text} ${colors.light} font-bold px-2 py-0.5 rounded-full text-[11px]`}>{formatDuration(elapsed)}</span>
                            <span className="text-slate-300">·</span>
                            <span className="truncate text-slate-400">{visit.child?.customer?.name || 'Cliente'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <button
                          onClick={() => handleCancelCheckIn(visit)}
                          className="p-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all duration-200"
                          title="Cancelar check-in"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                        <button
                          onClick={() => handleCheckOut(visit)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          Check-Out
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ações Rápidas */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-purple-200 rounded-xl flex items-center justify-center">
                  <span className="text-lg">⚡</span>
                </div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Ações Rápidas</h2>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50 to-teal-50 border border-emerald-200/60 hover:border-emerald-400 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/5 to-emerald-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <PlusIcon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors">Check-In</p>
                    <p className="text-xs text-slate-500 mt-0.5">Registrar entrada de criança</p>
                  </div>
                  <div className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 border border-blue-200/60 hover:border-blue-400 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/5 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <UserPlusIcon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-blue-700 transition-colors">Novo Cliente</p>
                    <p className="text-xs text-slate-500 mt-0.5">Cadastrar responsável</p>
                  </div>
                  <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            {/* Pagamentos Recentes */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-xl flex items-center justify-center">
                  <CreditCardIcon className="text-emerald-600" size={18} />
                </div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Pagamentos Recentes</h2>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {recentPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-[pulse-slow_3s_ease-in-out_infinite]">
                      <CreditCardIcon className="text-slate-400" size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Nenhum pagamento hoje</p>
                    <p className="text-xs text-slate-500">Os pagamentos aparecerão aqui</p>
                  </div>
                ) : (
                  recentPayments.map((payment) => (
                    <div key={payment.id} className="group flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-teal-50/30 transition-all duration-200 border border-transparent hover:border-emerald-200/50 hover:shadow-md">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-emerald-100 group-hover:to-teal-100 flex items-center justify-center flex-shrink-0 text-base transition-all duration-200 shadow-sm">
                        {getPaymentMethodIcon(payment.method)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{payment.childName || payment.description || 'Pagamento'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payment.type === 'package' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {payment.type === 'package' ? 'Pacote' : 'Avulso'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] text-slate-500 font-medium">{getPaymentMethodLabel(payment.method)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-base text-emerald-600 group-hover:text-emerald-700 transition-colors">R$ {payment.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Modal de Check-Out com Cálculo */}
      {selectedVisit && (
        <CheckOutModal
          isOpen={showCheckOutModal}
          onClose={() => {
            setShowCheckOutModal(false);
            setSelectedVisit(null);
          }}
          onSuccess={handleCheckOutSuccess}
          visit={selectedVisit}
        />
      )}

      {/* Modal de Cancelar Check-In */}
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

export default DashboardNew;
