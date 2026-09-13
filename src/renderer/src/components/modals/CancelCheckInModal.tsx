import React, { useState, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
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

  const checkInTime = visit.checkIn instanceof Date ? visit.checkIn : new Date(visit.checkIn);
  const timeSinceCheckIn = Date.now() - checkInTime.getTime();
  const requiresPassword = timeSinceCheckIn > CANCEL_TIME_LIMIT_MS;
  const minutesSinceCheckIn = Math.floor(timeSinceCheckIn / 60000);

  const handleCancel = async () => {
    if (processingRef.current) return;

    if (requiresPassword) {
      if (!password) {
        toast.error('Digite a senha de administrador para cancelar o check-in.');
        return;
      }
      if (password !== ADMIN_PASSWORD) {
        toast.error('Senha de administrador incorreta');
        setPassword('');
        return;
      }
    }

    const deductMin = minutesToDeduct ? parseInt(minutesToDeduct) : 0;
    if (deductMin < 0) {
      toast.error('Os minutos registrados não podem ser negativos.');
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
      toast.error('Não foi possível cancelar o check-in. Tente de novo em alguns segundos.');
      processingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="bg-paper-raised rounded-card-lg shadow-card-lg max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="text-lg font-bold text-ink-800">Cancelar Check-In</h2>
          <button onClick={onClose} disabled={loading} className="p-1 rounded-md hover:bg-ink-100 text-ink-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info */}
          <div className="text-center">
            <div className="w-12 h-12 bg-state-bad-soft rounded-card flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-state-bad" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            </div>
            <p className="text-sm text-ink-600">
              Cancelar check-in de <span className="font-bold text-ink-800">{visit.child?.name || 'Criança'}</span>?
            </p>
          </div>

          {/* Time info */}
          <div className="bg-paper border border-line rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">Tempo desde check-in</span>
              <span className="font-semibold text-ink-800">{minutesSinceCheckIn} min</span>
            </div>
            {requiresPassword && (
              <p className="text-xs text-state-warn font-medium mt-2">Passou de 5 min — senha de admin necessária</p>
            )}
          </div>

          {/* Minutes to deduct */}
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5">Minutos a registrar (opcional)</label>
            <input
              type="number"
              value={minutesToDeduct}
              onChange={(e) => setMinutesToDeduct(e.target.value)}
              placeholder="0 (cancelamento total)"
              min="0"
              max={minutesSinceCheckIn}
              className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus"
            />
            <p className="text-[11px] text-ink-400 mt-1">Ex: 13 min se a criança ficou 13 min antes de cancelar</p>
          </div>

          {/* Password */}
          {requiresPassword && (
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1.5">Senha Admin</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de administrador..."
                className="w-full px-3 py-2.5 border border-line-strong rounded-lg text-sm focus:outline-none focus-visible:shadow-focus"
                autoFocus
              />
            </div>
          )}

          {/* Warning */}
          <div className="bg-state-warn-soft border border-state-warn/30 rounded-lg px-3 py-2">
            <p className="text-xs text-state-warn">Esta ação não pode ser desfeita.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium text-ink-600 hover:bg-paper transition-colors disabled:opacity-50">
            Voltar
          </button>
          <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-state-bad hover:bg-danger-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {loading ? '⏳ Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default CancelCheckInModal;
