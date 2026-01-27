import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { DashboardStats, Visit, Payment } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { statsCache } from '../../../shared/cache/statsCache';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import CheckInModal from '../components/modals/CheckInModal';
import CustomerModal from '../components/modals/CustomerModal';
import PackageModal from '../components/modals/PackageModal';

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
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const loadingRef = useRef(false);

  const loadStats = useCallback(async (forceRefresh = false) => {
    if (loadingRef.current) return;
    
    const cacheKey = `dashboard-stats-${currentUnit}`;
    
    if (!forceRefresh) {
      const cached = statsCache.get<DashboardStats>(cacheKey);
      if (cached) {
        setStats(cached);
        setLoading(false);
        setIsInitialLoad(false);
        
        const cacheAge = statsCache.getAge(cacheKey);
        if (cacheAge && cacheAge > 10000) {
          setTimeout(() => loadStats(true), 100);
        }
        return;
      }
    }

    try {
      loadingRef.current = true;
      if (stats.activeVisits === 0 && stats.todayRevenue === 0) {
        setLoading(true);
      }
      
      const [visits, payments, packages] = await Promise.all([
        visitsServiceOffline.getActiveVisits(currentUnit),
        paymentsServiceOffline.getTodayPayments(),
        packagesServiceOffline.getActivePackages(),
      ]);

      setActiveVisits(visits);
      setRecentPayments(payments.slice(0, 5));

      const todayRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

      const newStats = {
        activeVisits: visits.length,
        todayRevenue,
        todayVisits: visits.length,
        activePackages: packages.length,
      };

      setStats(newStats);
      setIsInitialLoad(false);
      statsCache.set(cacheKey, newStats, 30000);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [currentUnit, stats.activeVisits, stats.todayRevenue]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleCheckOut = async (visit: Visit) => {
    setSelectedVisit(visit);
    setShowCheckOutModal(true);
  };

  const confirmCheckOut = async (paymentMethod: string) => {
    if (!selectedVisit) return;

    try {
      await visitsServiceOffline.checkOut({
        visitId: selectedVisit.id,
        paymentMethod,
      });
      
      toast.success('✅ Check-out realizado com sucesso!');
      setShowCheckOutModal(false);
      setSelectedVisit(null);
      loadStats(true);
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error('Erro ao realizar check-out');
    }
  };

  const unitInfo = getCurrentUnitInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navbar onRefresh={() => loadStats(true)} loading={loading} />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">🎯</span>
              {loading && isInitialLoad ? (
                <div className="animate-spin text-3xl">⏳</div>
              ) : null}
            </div>
            <p className="text-blue-100 text-sm font-medium mb-1">Visitas Ativas</p>
            <p className="text-5xl font-bold">{stats.activeVisits}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">💰</span>
            </div>
            <p className="text-green-100 text-sm font-medium mb-1">Receita Hoje</p>
            <p className="text-4xl font-bold">R$ {stats.todayRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <p className="text-purple-100 text-sm font-medium mb-1">Total Visitas Hoje</p>
            <p className="text-5xl font-bold">{stats.todayVisits}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-5xl">📦</span>
            </div>
            <p className="text-orange-100 text-sm font-medium mb-1">Pacotes Ativos</p>
            <p className="text-5xl font-bold">{stats.activePackages}</p>
          </div>
        </div>

        {/* Main Content - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Visitas Ativas (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span>🎯</span> Visitas Ativas em {unitInfo?.name}
              </h2>
              <button
                onClick={() => setShowCheckInModal(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg font-medium flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                Novo Check-In
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {loading && isInitialLoad ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 rounded-xl p-4">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </>
              ) : activeVisits.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-6xl mb-4">🎮</p>
                  <p className="text-xl font-medium">Nenhuma visita ativa</p>
                  <p className="text-sm mt-2">Faça um check-in para começar</p>
                </div>
              ) : (
                activeVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">👶</span>
                          <div>
                            <p className="font-bold text-lg text-gray-800">
                              {visit.child?.name || 'Criança'}
                            </p>
                            <p className="text-sm text-gray-600">
                              Check-in: {new Date(visit.checkIn).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-medium">
                            ⏱️ {Math.floor((Date.now() - new Date(visit.checkIn).getTime()) / 60000)} min
                          </span>
                          <span className="text-gray-600">
                            👤 {visit.child?.customer?.name || 'Cliente'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckOut(visit)}
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg font-bold"
                      >
                        ✓ Check-Out
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column - Ações Rápidas e Pagamentos (1/3) */}
          <div className="space-y-6">
            {/* Ações Rápidas */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⚡</span> Ações Rápidas
              </h2>
              <div className="space-y-3">
                <button
                  onClick={() => setShowCheckInModal(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl hover:opacity-90 transition-all shadow-lg text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">➕</span>
                    <div>
                      <p className="font-bold">Check-In</p>
                      <p className="text-sm opacity-90">Registrar entrada</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl hover:opacity-90 transition-all shadow-lg text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👥</span>
                    <div>
                      <p className="font-bold">Novo Cliente</p>
                      <p className="text-sm opacity-90">Cadastrar</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowPackageModal(true)}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl hover:opacity-90 transition-all shadow-lg text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📦</span>
                    <div>
                      <p className="font-bold">Novo Pacote</p>
                      <p className="text-sm opacity-90">Criar pacote</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Pagamentos Recentes */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💳</span> Pagamentos Recentes
              </h2>
              <div className="space-y-2">
                {recentPayments.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">
                    Nenhum pagamento hoje
                  </p>
                ) : (
                  recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-green-50 rounded-lg p-3 border border-green-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">
                            {payment.customer?.name || 'Cliente'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(payment.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <p className="font-bold text-green-600">
                          R$ {payment.amount.toFixed(2)}
                        </p>
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

      {/* Modal Check-Out */}
      {showCheckOutModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>✓</span> Confirmar Check-Out
            </h3>
            
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Criança</p>
              <p className="font-bold text-lg text-gray-800">{selectedVisit.child?.name}</p>
              <p className="text-sm text-gray-600 mt-2">
                Tempo: {Math.floor((Date.now() - new Date(selectedVisit.checkIn).getTime()) / 60000)} minutos
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <p className="font-medium text-gray-700">Método de Pagamento:</p>
              <button
                onClick={() => confirmCheckOut('dinheiro')}
                className="w-full bg-green-500 text-white p-4 rounded-xl hover:bg-green-600 transition-all font-medium"
              >
                💵 Dinheiro
              </button>
              <button
                onClick={() => confirmCheckOut('pix')}
                className="w-full bg-blue-500 text-white p-4 rounded-xl hover:bg-blue-600 transition-all font-medium"
              >
                📱 PIX
              </button>
              <button
                onClick={() => confirmCheckOut('cartao')}
                className="w-full bg-purple-500 text-white p-4 rounded-xl hover:bg-purple-600 transition-all font-medium"
              >
                💳 Cartão
              </button>
              <button
                onClick={() => confirmCheckOut('pacote')}
                className="w-full bg-orange-500 text-white p-4 rounded-xl hover:bg-orange-600 transition-all font-medium"
              >
                📦 Pacote de Horas
              </button>
            </div>

            <button
              onClick={() => {
                setShowCheckOutModal(false);
                setSelectedVisit(null);
              }}
              className="w-full bg-gray-200 text-gray-700 p-3 rounded-xl hover:bg-gray-300 transition-all font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardNew;
