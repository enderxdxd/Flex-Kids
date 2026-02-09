import React, { useState } from 'react';
import { Visit } from '../../../../shared/types';
import { visitsServiceOffline } from '../../../../shared/firebase/services/visits.service.offline';
import { toast } from 'react-toastify';

interface CancelCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visit: Visit;
}

const ADMIN_PASSWORD = 'pactoflex123';
const CANCEL_TIME_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

const CancelCheckInModal: React.FC<CancelCheckInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  visit,
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const checkInTime = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
  const timeSinceCheckIn = Date.now() - checkInTime.getTime();
  const requiresPassword = timeSinceCheckIn > CANCEL_TIME_LIMIT_MS;

  const handleCancel = async () => {
    try {
      // Se passou de 5 minutos, exige senha
      if (requiresPassword) {
        if (!password) {
          toast.error('Digite a senha de administrador');
          return;
        }
        if (password !== ADMIN_PASSWORD) {
          toast.error('Senha incorreta');
          setPassword('');
          return;
        }
      }

      setLoading(true);

      // Marcar visita como cancelada (fazer checkout imediato com 0 minutos)
      await visitsServiceOffline.checkOut({
        visitId: visit.id,
        duration: 0,
        value: 0,
        paymentMethod: 'cancelled',
      });

      toast.success('✅ Check-in cancelado com sucesso');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error canceling check-in:', error);
      toast.error('Erro ao cancelar check-in');
    } finally {
      setLoading(false);
    }
  };

  const minutesSinceCheckIn = Math.floor(timeSinceCheckIn / 60000);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Cancelar Check-In</h2>
          <p className="text-gray-600">
            Tem certeza que deseja cancelar o check-in de <span className="font-bold">{visit.child?.name || 'Criança'}</span>?
          </p>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-blue-800">
            <span className="font-bold">⏱️ Tempo desde check-in:</span> {minutesSinceCheckIn} minuto(s)
          </p>
          {requiresPassword && (
            <p className="text-sm text-red-700 mt-2">
              <span className="font-bold">🔒 Atenção:</span> Passou de 5 minutos. É necessária senha de administrador.
            </p>
          )}
        </div>

        {/* Campo de Senha (se necessário) */}
        {requiresPassword && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🔑 Senha de Administrador
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
              autoFocus
            />
          </div>
        )}

        {/* Aviso */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <span className="font-bold">⚠️ Atenção:</span> Esta ação não pode ser desfeita. O check-in será removido permanentemente.
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-500 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? '⏳ Cancelando...' : '🗑️ Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelCheckInModal;
