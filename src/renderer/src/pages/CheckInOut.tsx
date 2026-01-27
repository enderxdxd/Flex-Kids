import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useUnit } from '../contexts/UnitContext';
import { Visit, Child } from '../../../shared/types';
import { format, differenceInMinutes } from 'date-fns';
import { visitsServiceOffline } from '../../../shared/firebase/services/visits.service.offline';
import { customersServiceOffline } from '../../../shared/firebase/services/customers.service.offline';

const CheckInOut: React.FC = () => {
  const { currentUnit } = useUnit();
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [visits, allChildren] = await Promise.all([
        visitsServiceOffline.getActiveVisits(currentUnit),
        customersServiceOffline.getAllChildren(),
      ]);
      setActiveVisits(visits);
      setChildren(allChildren);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedChild) {
      toast.warning('Selecione uma criança');
      return;
    }

    const alreadyCheckedIn = activeVisits.some(v => v.childId === selectedChild);
    if (alreadyCheckedIn) {
      toast.error('Esta criança já está com check-in ativo!');
      return;
    }

    try {
      await visitsServiceOffline.checkIn({
        childId: selectedChild,
        unitId: currentUnit,
      });
      toast.success('✅ Check-in realizado com sucesso!');
      setSelectedChild('');
      setSearchTerm('');
      loadData();
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Erro ao realizar check-in');
    }
  };

  const handleCheckOut = async (visitId: string, childName: string) => {
    if (!confirm(`Confirmar check-out de ${childName}?`)) {
      return;
    }

    try {
      await visitsServiceOffline.checkOut({ visitId });
      toast.success('✅ Check-out realizado com sucesso!');
      loadData();
    } catch (error) {
      console.error('Error during check-out:', error);
      toast.error('Erro ao realizar check-out');
    }
  };

  const calculateDuration = (checkIn: Date) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateEstimatedCost = (checkIn: Date, hourlyRate: number = 30) => {
    const minutes = differenceInMinutes(new Date(), new Date(checkIn));
    const hours = minutes / 60;
    return (hours * hourlyRate).toFixed(2);
  };

  const filteredChildren = children.filter(child =>
    child.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Check-In / Check-Out</h1>
          <p className="text-gray-500">Gerenciar entradas e saídas - {activeVisits.length} visitas ativas</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span>➕</span> Novo Check-In
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-blue-100">
                  Buscar Criança
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome..."
                  className="w-full px-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-blue-100">
                  Selecione a Criança
                </label>
                <select
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Selecione...</option>
                  {filteredChildren.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({child.age} anos)
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={!selectedChild || loading}
                className="w-full bg-white text-blue-600 py-4 rounded-lg font-bold hover:bg-blue-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
              >
                ✓ Realizar Check-In
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Estatísticas</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-gray-700">Visitas Ativas</span>
                <span className="text-2xl font-bold text-blue-600">{activeVisits.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-gray-700">Crianças Cadastradas</span>
                <span className="text-2xl font-bold text-green-600">{children.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Visitas Ativas
              </h2>
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold">
                {activeVisits.length}
              </span>
            </div>
            
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-6 border border-gray-200 rounded-xl">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : activeVisits.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-6xl mb-4">🎯</p>
                <p className="text-xl font-medium">Nenhuma visita ativa</p>
                <p className="text-sm mt-2">Faça o primeiro check-in do dia!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeVisits.map((visit) => {
                  const child = children.find((c) => c.id === visit.childId);
                  const duration = calculateDuration(visit.checkIn);
                  const estimatedCost = calculateEstimatedCost(visit.checkIn);
                  
                  return (
                    <div
                      key={visit.id}
                      className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                              {child?.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-xl text-gray-800">
                                {child?.name || 'Criança não encontrada'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {child?.age} anos
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Check-in</p>
                              <p className="font-bold text-blue-600">
                                {format(new Date(visit.checkIn), 'HH:mm')}
                              </p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Duração</p>
                              <p className="font-bold text-purple-600">{duration}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-600 mb-1">Estimativa</p>
                              <p className="font-bold text-green-600">R$ {estimatedCost}</p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleCheckOut(visit.id, child?.name || 'Criança')}
                          className="ml-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-all transform hover:scale-105 shadow-lg"
                        >
                          ✓ Check-Out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInOut;
