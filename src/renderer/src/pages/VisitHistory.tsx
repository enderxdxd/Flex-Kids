import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visit, Child, Package } from '../../../shared/types';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';
import { packagesServiceOffline } from '../../../shared/firebase/services/packages.service.offline';

const VisitHistory: React.FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [filteredChildren, setFilteredChildren] = useState<Child[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredChildren(children);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = children.filter(child => {
        const customer = customers.find(c => c.id === child.customerId);
        const childName = child.name.toLowerCase();
        const customerName = customer?.name.toLowerCase() || '';
        return childName.includes(term) || customerName.includes(term);
      });
      setFilteredChildren(filtered);
    }
  }, [searchTerm, children, customers]);

  useEffect(() => {
    if (selectedChildId) {
      loadChildData();
    }
  }, [selectedChildId]);

  const loadChildren = async () => {
    try {
      const [allChildren, allCustomers] = await Promise.all([
        customersServiceOffline.getAllChildren(),
        customersServiceOffline.getAllCustomers(),
      ]);
      setChildren(allChildren);
      setFilteredChildren(allChildren);
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading children:', error);
      toast.error('Erro ao carregar crianças');
    }
  };

  const loadChildData = async () => {
    if (!selectedChildId) return;
    
    try {
      setLoading(true);
      
      // Buscar visitas da criança
      const allVisits = await visitsServiceOffline.getAllVisits();
      const childVisits = allVisits
        .filter(v => v.childId === selectedChildId)
        .sort((a, b) => {
          const aTime = a.checkIn instanceof Date ? a.checkIn.getTime() : new Date(a.checkIn).getTime();
          const bTime = b.checkIn instanceof Date ? b.checkIn.getTime() : new Date(b.checkIn).getTime();
          return bTime - aTime;
        });
      setVisits(childVisits);

      // Buscar pacotes da criança
      const allPackages = await packagesServiceOffline.getActivePackages();
      const childPackages = allPackages.filter(p => p.childId === selectedChildId);
      setPackages(childPackages);
    } catch (error) {
      console.error('Error loading child data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const calculateDuration = (checkIn: Date, checkOut?: Date) => {
    const start = checkIn instanceof Date ? checkIn : new Date(checkIn);
    const end = checkOut ? (checkOut instanceof Date ? checkOut : new Date(checkOut)) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60));
  };

  const totalVisits = visits.filter(v => v.checkOut).length;
  const totalMinutes = visits
    .filter(v => v.checkOut)
    .reduce((sum, v) => sum + calculateDuration(v.checkIn, v.checkOut), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📋 Histórico de Visitas</h1>
          <p className="text-gray-500">Visualize visitas e saldo de pacotes</p>
        </div>
      </div>

      {/* Busca e Seletor de Criança */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <label className="block text-sm font-bold text-gray-700 mb-3">
          � Buscar e Selecionar Criança
        </label>
        
        {/* Campo de Busca */}
        <input
          type="text"
          placeholder="Digite o nome da criança ou responsável..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg mb-3"
        />
        
        {/* Seletor */}
        <select
          value={selectedChildId}
          onChange={(e) => setSelectedChildId(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
        >
          <option value="">Selecione uma criança...</option>
          {filteredChildren.map((child) => {
            const customer = customers.find(c => c.id === child.customerId);
            const customerName = customer?.name || 'Responsável desconhecido';
            return (
              <option key={child.id} value={child.id}>
                {child.name} ({child.age} anos) - Responsável: {customerName}
              </option>
            );
          })}
        </select>
        
        {searchTerm && filteredChildren.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Nenhuma criança encontrada com "{searchTerm}"
          </p>
        )}
        
        {searchTerm && filteredChildren.length > 0 && (
          <p className="text-sm text-green-600 mt-2">
            {filteredChildren.length} criança(s) encontrada(s)
          </p>
        )}
      </div>

      {selectedChildId && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-blue-100 text-sm font-medium">Total de Visitas</p>
                <span className="text-3xl">📊</span>
              </div>
              <p className="text-4xl font-bold">{totalVisits}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-green-100 text-sm font-medium">Tempo Total</p>
                <span className="text-3xl">⏱️</span>
              </div>
              <p className="text-4xl font-bold">{formatDuration(totalMinutes)}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-purple-100 text-sm font-medium">Pacotes Ativos</p>
                <span className="text-3xl">📦</span>
              </div>
              <p className="text-4xl font-bold">{packages.length}</p>
            </div>
          </div>

          {/* Saldo dos Pacotes */}
          {packages.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📦 Saldo dos Pacotes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map((pkg) => {
                  const remaining = Math.max(pkg.hours - pkg.usedHours, 0);
                  const progress = (pkg.usedHours / pkg.hours) * 100;
                  const isExpired = pkg.expiresAt && new Date(pkg.expiresAt) < new Date();
                  
                  return (
                    <div
                      key={pkg.id}
                      className={`border-2 rounded-xl p-5 ${
                        pkg.active && !isExpired ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">{pkg.type}</h3>
                          <p className="text-sm text-gray-500">
                            Comprado em {format(new Date(pkg.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded-full ${
                            pkg.active && !isExpired
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isExpired ? '⚠️ Expirado' : pkg.active ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Utilizado</span>
                          <span className="font-bold text-gray-800">
                            {pkg.usedHours.toFixed(1)}h / {pkg.hours}h
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-4 rounded-full transition-all ${
                              progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-yellow-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Saldo Restante */}
                      <div className="bg-white rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700 font-medium">Saldo Restante:</span>
                          <span className={`text-2xl font-bold ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {remaining.toFixed(1)}h
                          </span>
                        </div>
                        {remaining > 0 && (
                          <p className="text-sm text-gray-500 mt-1">
                            ≈ {Math.floor(remaining)} visitas de 1h restantes
                          </p>
                        )}
                      </div>

                      {pkg.expiresAt && (
                        <p className={`text-sm mt-2 ${isExpired ? 'text-red-600' : 'text-blue-600'}`}>
                          {isExpired ? '⚠️ Expirou em: ' : '📅 Expira em: '}
                          {format(new Date(pkg.expiresAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de Visitas */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">📜 Histórico de Visitas</h2>
              <button
                onClick={loadChildData}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? '⏳' : '🔄'} Atualizar
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-4 border border-gray-200 rounded-lg">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-6xl mb-4">📋</p>
                <p className="text-xl font-medium">Nenhuma visita encontrada</p>
                <p className="text-sm mt-2">Esta criança ainda não tem visitas registradas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visits.map((visit) => {
                  const checkInDate = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
                  const checkOutDate = visit.checkOut 
                    ? (visit.checkOut instanceof Date ? visit.checkOut : new Date(visit.checkOut))
                    : null;
                  const duration = checkOutDate ? calculateDuration(checkInDate, checkOutDate) : null;
                  const isActive = !visit.checkOut;

                  return (
                    <div
                      key={visit.id}
                      className={`border-2 rounded-xl p-4 transition-all ${
                        isActive 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{isActive ? '🟢' : '✅'}</span>
                            <div>
                              <p className="font-bold text-lg text-gray-800">
                                {format(checkInDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              <p className="text-sm text-gray-500">
                                Check-in: {format(checkInDate, 'HH:mm')}
                                {checkOutDate && ` → Check-out: ${format(checkOutDate, 'HH:mm')}`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {isActive ? (
                            <span className="px-4 py-2 bg-green-500 text-white rounded-full font-bold text-sm">
                              🟢 Em andamento
                            </span>
                          ) : (
                            <div>
                              <p className="text-2xl font-bold text-blue-600">
                                {duration ? formatDuration(duration) : '-'}
                              </p>
                              {visit.value && visit.value > 0 && (
                                <p className="text-sm text-green-600 font-medium">
                                  R$ {visit.value.toFixed(2)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VisitHistory;
