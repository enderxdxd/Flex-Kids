import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Child, Customer } from '../../../../shared/types';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';
import { paymentsServiceOffline } from '../../../../shared/firebase/services/payments.service.offline';
import { settingsServiceOffline } from '../../../../shared/firebase/services/settings.service.offline';
import { useUnit } from '../../contexts/UnitContext';

interface PackagePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  packageData: {
    customerId: string;
    childId?: string;
    type: string;
    hours: number;
    price: number;
    expiryDays?: number;
  };
  child?: Child;
  customer: Customer;
}

const PackagePaymentModal: React.FC<PackagePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  packageData,
  child,
  customer,
}) => {
  const { currentUnit } = useUnit();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit'>('pix');
  const [loading, setLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const processingRef = useRef(false);

  if (!isOpen) return null;

  const printFiscalReceipt = async () => {
    try {
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig();
      if (!fiscalConfig?.enableFiscalPrint) return;

      const { bematechService } = await import('../../../../shared/services/bematech.service');
      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) return;

      const methodLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'CREDITO' : 'DEBITO';
      const now = new Date();
      const lines: string[] = [
        '================================',
        '     COMPROVANTE DE PACOTE      ',
        '================================',
        '',
        `Data: ${format(now, 'dd/MM/yyyy HH:mm')}`,
        '',
        `Cliente: ${customer.name}`,
        child ? `Crianca: ${child.name}` : '',
        '',
        '--------------------------------',
        `Pacote: ${packageData.type}`,
        `Horas:  ${packageData.hours}h`,
        `Validade: ${packageData.expiryDays || 30} dias`,
        '--------------------------------',
        '',
        `Pagamento: ${methodLabel}`,
        `TOTAL: R$ ${packageData.price.toFixed(2)}`,
        '',
        '================================',
        '    Obrigado pela preferencia!   ',
        '================================',
      ].filter(Boolean);

      await bematechService.printNonFiscalReport('VENDA DE PACOTE', lines);
    } catch (error) {
      console.error('Error printing fiscal receipt:', error);
    }
  };

  const handleConfirmPayment = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);

    try {
      const payment = await paymentsServiceOffline.createPayment({
        customerId: customer.id,
        childId: child?.id,
        childName: child?.name,
        amount: packageData.price,
        method: paymentMethod,
        status: 'paid',
        type: 'package',
        unitId: currentUnit,
        description: `${packageData.type} - ${customer.name}`,
      });

      await packagesServiceOffline.createPackage({
        ...packageData,
        usedHours: 0,
        active: true,
        sharedAcrossUnits: true,
        unitId: currentUnit,
        paymentId: payment.id,
      });

      if (printReceipt) {
        await printFiscalReceipt();
      }

      toast.success('Pagamento confirmado e pacote ativado!');
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao processar pagamento');
      processingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Pagamento do Pacote</h2>
          <button onClick={onClose} disabled={loading} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Responsável</span>
                <span className="font-semibold text-slate-800">{customer.name}</span>
              </div>
              {child && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Criança</span>
                  <span className="font-semibold text-slate-800">{child.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Pacote</span>
                <span className="font-semibold text-slate-800">{packageData.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Horas</span>
                <span className="font-semibold text-slate-800">{packageData.hours}h</span>
              </div>
              {packageData.expiryDays && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Validade</span>
                  <span className="font-semibold text-slate-800">{packageData.expiryDays} dias</span>
                </div>
              )}
              <div className="flex justify-between border-t border-violet-200 pt-2 mt-1">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-xl font-bold text-emerald-600">R$ {packageData.price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {(['pix', 'credit', 'debit'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-lg transition-all border text-center ${
                    paymentMethod === method
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 hover:border-violet-300'
                  }`}
                >
                  <div className="text-xl mb-1">{method === 'pix' ? '📱' : '💳'}</div>
                  <div className="text-xs font-medium text-slate-700">
                    {method === 'pix' ? 'PIX' : method === 'credit' ? 'Crédito' : 'Débito'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Print option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={printReceipt} onChange={(e) => setPrintReceipt(e.target.checked)} className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500" />
            <span className="text-sm text-slate-600">Imprimir comprovante fiscal</span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirmPayment} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {loading ? '⏳ Processando...' : `Confirmar R$ ${packageData.price.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackagePaymentModal;
