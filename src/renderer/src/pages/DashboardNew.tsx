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
        paymentsServiceOffline.getTodayPayments(),
        packagesServiceOffline.getActivePackages(undefined, currentUnit),
      ]);

      const unitPayments = payments.filter(p => p.unitId === currentUnit);

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

      <div className="ml-[240px] p-6 space-y-6">
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
              className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <span>➕</span> Novo Check-In
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              {loading && isInitialLoad && <div className="animate-spin text-sm">⏳</div>}
            </div>
            <p className="text-sm text-slate-500 font-medium">Visitas Ativas</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.activeVisits}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
              <span className="text-xl">💰</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">Receita Hoje</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">R$ {stats.todayRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
              <span className="text-xl">📊</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">Total Visitas Hoje</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.todayVisits}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
              <span className="text-xl">📦</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">Pacotes Ativos</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.activePackages}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visitas Ativas */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Visitas Ativas</h2>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {loading && isInitialLoad ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse bg-slate-100 rounded-lg p-4">
                    <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))
              ) : activeVisits.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-5xl mb-3">🎮</p>
                  <p className="font-medium">Nenhuma visita ativa</p>
                  <p className="text-sm mt-1">Faça um check-in para começar</p>
                </div>
              ) : (
                [...activeVisits]
                .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                .map((visit) => {
                  const elapsed = Math.max(0, Math.floor((now - new Date(visit.checkIn).getTime()) / 60000));
                  const colors = getTimeColor(elapsed);
                  const progressPct = Math.min((elapsed / 240) * 100, 100);
                  return (
                  <div key={visit.id} className="bg-slate-50 rounded-lg border border-slate-100 hover:border-violet-200 transition-colors overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 ${colors.light} rounded-full flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">👶</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800 truncate">{visit.child?.name || 'Criança'}</p>
                            {visit.kidsPlanId && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-semibold flex-shrink-0">Kids</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>Check-in: {new Date(visit.checkIn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-slate-300">|</span>
                            <span className={`${colors.text} font-bold`}>{formatDuration(elapsed)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="truncate">{visit.child?.customer?.name || 'Cliente'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0 ml-3">
                        <button
                          onClick={() => handleCancelCheckIn(visit)}
                          className="p-2 rounded-lg bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                          title="Cancelar check-in"
                        >
                          ❌
                        </button>
                        <button
                          onClick={() => handleCheckOut(visit)}
                          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
                        >
                          Check-Out
                        </button>
                      </div>
                    </div>
                    {/* Time progress bar */}
                    <div className="h-1 bg-slate-200">
                      <div className={`h-full ${colors.bg} transition-all duration-1000 ease-linear rounded-r-full`} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Ações Rápidas */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Ações Rápidas</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors text-left"
                >
                  <span className="text-xl">➕</span>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">Check-In</p>
                    <p className="text-xs text-slate-500">Registrar entrada</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors text-left"
                >
                  <span className="text-xl">👥</span>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">Novo Cliente</p>
                    <p className="text-xs text-slate-500">Cadastrar responsável</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Pagamentos Recentes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Pagamentos Recentes</h2>
              <div className="space-y-2">
                {recentPayments.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">Nenhum pagamento hoje</p>
                ) : (
                  recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm">
                        {getPaymentMethodIcon(payment.method)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-700 truncate">{payment.childName || payment.description || 'Pagamento'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {new Date(payment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${payment.type === 'package' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {payment.type === 'package' ? 'Pacote' : 'Visita'}
                          </span>
                          <span className="text-[9px] text-slate-400">{getPaymentMethodLabel(payment.method)}</span>
                        </div>
                      </div>
                      <p className="font-bold text-sm text-emerald-600 flex-shrink-0">R$ {payment.amount.toFixed(2)}</p>
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
