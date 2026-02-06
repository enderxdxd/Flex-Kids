import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnit } from '../contexts/UnitContext';
import { DashboardStats } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { paymentsServiceOffline } from '../../../shared/firebase/services/payments.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';
import { statsCache } from '../../../shared/cache/statsCache';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUnit } = useUnit();
  const [stats, setStats] = useState<DashboardStats>({
    activeVisits: 0,
    todayRevenue: 0,
    todayVisits: 0,
    activePackages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const loadingRef = useRef(false);

  // Debug: Verifica status da impressora ao carregar
  useEffect(() => {
    const checkPrinterStatus = async () => {
      try {
        const api = (window as any).electronAPI?.printer;
        if (api) {
          console.log('🖨️ [PRINTER DEBUG] API disponível, verificando status...');
          const status = await api.getStatus();
          console.log('🖨️ [PRINTER DEBUG] Status:', status);
          const logs = await api.getLogs();
          console.log('🖨️ [PRINTER DEBUG] Logs do main process:', logs);
          const ports = await api.listPorts();
          console.log('🖨️ [PRINTER DEBUG] Portas disponíveis:', ports);
        } else {
          console.warn('🖨️ [PRINTER DEBUG] API de impressora NÃO disponível no window.electronAPI');
          console.log('🖨️ [PRINTER DEBUG] window.electronAPI:', (window as any).electronAPI);
        }
      } catch (err) {
        console.error('🖨️ [PRINTER DEBUG] Erro ao verificar impressora:', err);
      }
    };
    checkPrinterStatus();
  }, []);

  const loadStats = useCallback(async (forceRefresh = false) => {
    // Evita múltiplas chamadas simultâneas
    if (loadingRef.current) return;
    
    const cacheKey = `dashboard-stats-${currentUnit || 'all'}`;
    
    // Tenta buscar do cache primeiro (instantâneo)
    if (!forceRefresh) {
      const cached = statsCache.get<DashboardStats>(cacheKey);
      if (cached) {
        setStats(cached);
        setLoading(false);
        setIsInitialLoad(false);
        
        // Atualiza em background se o cache tem mais de 10 segundos
        const cacheAge = statsCache.getAge(cacheKey);
        if (cacheAge && cacheAge > 10000) {
          setTimeout(() => loadStats(true), 100);
        }
        return;
      }
    }

    try {
      loadingRef.current = true;
      // Só mostra loading se não tiver dados em cache
      if (stats.activeVisits === 0 && stats.todayRevenue === 0) {
        setLoading(true);
      }
      setError(null);
      
      // Carrega dados em paralelo do cache local (muito rápido)
      const [activeVisits, todayPayments, activePackages] = await Promise.all([
        visitsServiceOffline.getActiveVisits(currentUnit),
        paymentsServiceOffline.getTodayPayments(),
        packagesServiceOffline.getActivePackages(),
      ]);

      const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

      const newStats = {
        activeVisits: activeVisits.length,
        todayRevenue,
        todayVisits: activeVisits.length,
        activePackages: activePackages.length,
      };

      setStats(newStats);
      setIsInitialLoad(false);
      
      // Salva no cache por 30 segundos
      statsCache.set(cacheKey, newStats, 30000);
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Erro ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [currentUnit, stats.activeVisits, stats.todayRevenue]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    icon: string; 
    bgColor: string;
    textColor: string;
    loading?: boolean;
  }> = ({ title, value, icon, bgColor, textColor, loading }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
      {loading && isInitialLoad ? (
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className={`${bgColor} ${textColor} p-3 rounded-lg text-2xl transition-all duration-300`}>
              {icon}
            </div>
          </div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-800 transition-all duration-300">{value}</p>
        </>
      )}
    </div>
  );

  const QuickActionButton: React.FC<{
    icon: string;
    title: string;
    description: string;
    onClick: () => void;
    color: string;
  }> = ({ icon, title, description, onClick, color }) => (
    <button
      onClick={onClick}
      className={`${color} text-white rounded-xl p-6 hover:opacity-90 transition-all duration-300 transform hover:scale-105 shadow-lg`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-bold text-lg mb-1">{title}</div>
      <div className="text-sm opacity-90">{description}</div>
    </button>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-500">Visão geral do sistema - {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <button
          onClick={() => loadStats(true)}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <p className="font-medium text-red-800">Erro ao carregar dados</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Visitas Ativas"
          value={stats.activeVisits}
          icon="🎯"
          bgColor="bg-blue-100"
          textColor="text-blue-600"
          loading={loading}
        />
        <StatCard
          title="Receita Hoje"
          value={`R$ ${stats.todayRevenue.toFixed(2)}`}
          icon="💰"
          bgColor="bg-green-100"
          textColor="text-green-600"
          loading={loading}
        />
        <StatCard
          title="Visitas Hoje"
          value={stats.todayVisits}
          icon="📊"
          bgColor="bg-purple-100"
          textColor="text-purple-600"
          loading={loading}
        />
        <StatCard
          title="Pacotes Ativos"
          value={stats.activePackages}
          icon="📦"
          bgColor="bg-orange-100"
          textColor="text-orange-600"
          loading={loading}
        />
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionButton
            icon="➕"
            title="Check-In"
            description="Registrar nova entrada"
            onClick={() => navigate('/checkinout')}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <QuickActionButton
            icon="👥"
            title="Novo Cliente"
            description="Cadastrar cliente"
            onClick={() => navigate('/customers')}
            color="bg-gradient-to-br from-green-500 to-green-600"
          />
          <QuickActionButton
            icon="📦"
            title="Novo Pacote"
            description="Criar pacote de horas"
            onClick={() => navigate('/packages')}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Atividades Recentes</h3>
          <div className="space-y-3">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">�</p>
                <p>Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Resumo Financeiro</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <span className="font-medium text-gray-700">Receita Hoje</span>
              <span className="text-xl font-bold text-green-600">
                R$ {stats.todayRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <span className="font-medium text-gray-700">Visitas Ativas</span>
              <span className="text-xl font-bold text-blue-600">
                {stats.activeVisits}
              </span>
            </div>
            <button
              onClick={() => navigate('/payments')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Ver Todos os Pagamentos →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
