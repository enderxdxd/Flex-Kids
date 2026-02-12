import React, { useState, useRef } from 'react';
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
  const [minutesToDeduct, setMinutesToDeduct] = useState('');
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);

  if (!isOpen) return null;

  const checkInTime = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
  const timeSinceCheckIn = Date.now() - checkInTime.getTime();
  const requiresPassword = timeSinceCheckIn > CANCEL_TIME_LIMIT_MS;
  const minutesSinceCheckIn = Math.floor(timeSinceCheckIn / 60000);

  const handleCancel = async () => {
    if (processingRef.current) return;

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

    const deductMin = minutesToDeduct ? parseInt(minutesToDeduct) : 0;
    if (deductMin < 0) {
      toast.error('Minutos não pode ser negativo');
      return;
    }

    processingRef.current = true;
    setLoading(true);

    try {
      await visitsServiceOffline.checkOut({
        visitId: visit.id,
        duration: deductMin,
        value: 0,
        paymentMethod: 'cancelled',
      });

      toast.success(`Check-in cancelado${deductMin > 0 ? ` (${deductMin} min registrados)` : ''}`);
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error canceling check-in:', error);
      toast.error('Erro ao cancelar check-in');
      processingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Cancelar Check-In</h2>
          <button onClick={onClose} disabled={loading} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info */}
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-sm text-slate-600">
              Cancelar check-in de <span className="font-bold text-slate-800">{visit.child?.name || 'Criança'}</span>?
            </p>
          </div>

          {/* Time info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tempo desde check-in</span>
              <span className="font-semibold text-slate-800">{minutesSinceCheckIn} min</span>
            </div>
            {requiresPassword && (
              <p className="text-xs text-amber-600 font-medium mt-2">Passou de 5 min — senha de admin necessária</p>
            )}
          </div>

          {/* Minutes to deduct */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Minutos a registrar (opcional)</label>
            <input
              type="number"
              value={minutesToDeduct}
              onChange={(e) => setMinutesToDeduct(e.target.value)}
              placeholder="0 (cancelamento total)"
              min="0"
              max={minutesSinceCheckIn}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Ex: 13 min se a criança ficou 13 min antes de cancelar</p>
          </div>

          {/* Password */}
          {requiresPassword && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha Admin</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de administrador..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700">Esta ação não pode ser desfeita.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Voltar
          </button>
          <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {loading ? '⏳ Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelCheckInModal;
