import React, { useEffect, useState } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { DashboardStats } from '@shared/types';
import { visitsService, paymentsService, packagesService } from '@shared/firebase/services';

const Dashboard: React.FC = () => {
  const { currentUnit } = useUnit();
  const [stats, setStats] = useState<DashboardStats>({
    activeVisits: 0,
    todayRevenue: 0,
    todayVisits: 0,
    activePackages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [currentUnit]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const activeVisits = await visitsService.getActiveVisits(currentUnit);
      const todayPayments = await paymentsService.getTodayPayments();
      const activePackages = await packagesService.getActivePackages();

      const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

      setStats({
        activeVisits: activeVisits.length,
        todayRevenue,
        todayVisits: activeVisits.length,
        activePackages: activePackages.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{ title: string; value: string | number; icon: string; color: string }> = ({
    title,
    value,
    icon,
    color,
  }) => (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-2">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Visitas Ativas"
          value={stats.activeVisits}
          icon="🎯"
          color="border-blue-500"
        />
        <StatCard
          title="Receita Hoje"
          value={`R$ ${stats.todayRevenue.toFixed(2)}`}
          icon="💰"
          color="border-green-500"
        />
        <StatCard
          title="Visitas Hoje"
          value={stats.todayVisits}
          icon="📊"
          color="border-purple-500"
        />
        <StatCard
          title="Pacotes Ativos"
          value={stats.activePackages}
          icon="📦"
          color="border-orange-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border-2 border-primary-500 rounded-lg hover:bg-primary-50 transition-colors">
            <div className="text-2xl mb-2">➕</div>
            <div className="font-medium">Novo Check-In</div>
          </button>
          <button className="p-4 border-2 border-primary-500 rounded-lg hover:bg-primary-50 transition-colors">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-medium">Novo Cliente</div>
          </button>
          <button className="p-4 border-2 border-primary-500 rounded-lg hover:bg-primary-50 transition-colors">
            <div className="text-2xl mb-2">📦</div>
            <div className="font-medium">Novo Pacote</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
