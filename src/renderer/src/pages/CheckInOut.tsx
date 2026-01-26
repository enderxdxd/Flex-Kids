import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useUnit } from '../contexts/UnitContext';
import { Visit, Child } from '@shared/types';
import { format, differenceInMinutes } from 'date-fns';
import { visitsService, customersService } from '@shared/firebase/services';

const CheckInOut: React.FC = () => {
  const { currentUnit } = useUnit();
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUnit]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [visits, allChildren] = await Promise.all([
        visitsService.getActiveVisits(currentUnit),
        customersService.getAllChildren(),
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

    try {
      await visitsService.checkIn({
        childId: selectedChild,
        unitId: currentUnit,
      });
      toast.success('Check-in realizado com sucesso!');
      setSelectedChild('');
      loadData();
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Erro ao realizar check-in');
    }
  };

  const handleCheckOut = async (visitId: string) => {
    try {
      await visitsService.checkOut({ visitId });
      toast.success('Check-out realizado com sucesso!');
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Check-In / Check-Out</h1>
        <p className="text-gray-500 mt-2">Gerenciar entradas e saídas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Novo Check-In</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione a Criança
                </label>
                <select
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione...</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({child.age} anos)
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCheckIn}
                disabled={!selectedChild || loading}
                className="w-full bg-primary-500 text-white py-3 rounded-lg font-medium hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Realizar Check-In
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Visitas Ativas ({activeVisits.length})
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : activeVisits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma visita ativa no momento
              </div>
            ) : (
              <div className="space-y-3">
                {activeVisits.map((visit) => {
                  const child = children.find((c) => c.id === visit.childId);
                  return (
                    <div
                      key={visit.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">
                          {child?.name || 'Criança não encontrada'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Check-in: {format(new Date(visit.checkIn), 'HH:mm')}
                        </p>
                        <p className="text-sm text-gray-600 font-medium">
                          Duração: {calculateDuration(visit.checkIn)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCheckOut(visit.id)}
                        className="bg-red-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
                      >
                        Check-Out
                      </button>
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
