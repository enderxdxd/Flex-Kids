import React, { useState, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
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
  renewalPackageId?: string;
  remainingHours?: number;
}

const PackagePaymentModal: React.FC<PackagePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  packageData,
  child,
  customer,
  renewalPackageId,
  remainingHours = 0,
}) => {
  const isRenewal = !!renewalPackageId;
  const totalHoursAfterRenewal = packageData.hours + remainingHours;
  const { currentUnit } = useUnit();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit'>('pix');
  const [loading, setLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [employeeDiscount, setEmployeeDiscount] = useState(false);
  const processingRef = useRef(false);

  const finalPrice = employeeDiscount ? packageData.price * 0.5 : packageData.price;
  const purchaseDate = new Date();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + (packageData.expiryDays || 90));

  const printFiscalReceipt = async () => {
    try {
      const fiscalConfig = await settingsServiceOffline.getFiscalConfig(currentUnit);
      if (!fiscalConfig?.enableFiscalPrint) return;

      const { bematechService } = await import('../../../../shared/services/bematech.service');
      const initialized = await bematechService.initialize(fiscalConfig);
      if (!initialized) return;

      const methodLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'credit' ? 'CREDITO' : 'DEBITO';
      const now = new Date();
      const lines: string[] = [
        '================================',
        isRenewal ? '    RENOVACAO DE PACOTE         ' : '     COMPROVANTE DE PACOTE      ',
        '================================',
        '',
        `Data: ${format(now, 'dd/MM/yyyy HH:mm')}`,
        '',
        `Cliente: ${customer.name}`,
        child ? `Crianca: ${child.name}` : '',
        '',
        '--------------------------------',
        `Pacote: ${packageData.type}`,
        isRenewal ? `Horas Anteriores: ${remainingHours.toFixed(1)}h` : '',
        isRenewal ? `Horas Adicionais: ${packageData.hours}h` : '',
        isRenewal ? `TOTAL HORAS: ${totalHoursAfterRenewal}h` : `Horas:  ${packageData.hours}h`,
        `Validade: ${packageData.expiryDays || 90} dias`,
        `Expira em: ${format(expirationDate, 'dd/MM/yyyy')}`,
        employeeDiscount ? `Desconto Colaborador: 50%` : '',
        employeeDiscount ? `Preco Original: R$ ${packageData.price.toFixed(2)}` : '',
        '--------------------------------',
        '',
        `Pagamento: ${methodLabel}`,
        `TOTAL: R$ ${finalPrice.toFixed(2)}`,
        '',
        '================================',
        '    Obrigado pela preferencia!   ',
        '================================',
      ].filter(Boolean);

      await bematechService.printNonFiscalReport(isRenewal ? 'RENOVACAO DE PACOTE' : 'VENDA DE PACOTE', lines);
    } catch (error) {
      console.error('Error printing fiscal receipt:', error);
    }
  };

  const handleConfirmPayment = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);

    try {
      const discountDesc = employeeDiscount ? ' (desconto colaborador 50%)' : '';
      const renewalDesc = isRenewal ? ' (renovação)' : '';
      const payment = await paymentsServiceOffline.createPayment({
        customerId: customer.id,
        childId: child?.id,
        childName: child?.name,
        amount: finalPrice,
        method: paymentMethod,
        status: 'paid',
        type: 'package',
        unitId: currentUnit,
        description: `${packageData.type} - ${customer.name}${discountDesc}${renewalDesc}`,
      });

      if (isRenewal && renewalPackageId) {
        await packagesServiceOffline.updatePackage(renewalPackageId, {
          hours: totalHoursAfterRenewal,
          usedHours: 0,
          price: finalPrice,
          active: true,
          expiryDays: packageData.expiryDays || 30,
          createdAt: new Date(),
          expiresAt: expirationDate,
          paymentId: payment.id,
          employeeDiscount: employeeDiscount || undefined,
          originalPrice: employeeDiscount ? packageData.price : undefined,
        });
      } else {
        await packagesServiceOffline.createPackage({
          ...packageData,
          price: finalPrice,
          usedHours: 0,
          active: true,
          sharedAcrossUnits: false,
          unitId: currentUnit,
          paymentId: payment.id,
          employeeDiscount: employeeDiscount || undefined,
          originalPrice: employeeDiscount ? packageData.price : undefined,
        });
      }

      if (printReceipt) {
        await printFiscalReceipt();
      }

      toast.success(isRenewal ? `Pacote renovado! ${totalHoursAfterRenewal}h totais` : 'Pagamento confirmado e pacote ativado!');
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
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">{isRenewal ? 'Renovação do Pacote' : 'Pagamento do Pacote'}</h2>
          <button onClick={onClose} disabled={loading} className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg></button>
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
              {isRenewal && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Horas Restantes</span>
                  <span className="font-semibold text-amber-600">{remainingHours.toFixed(1)}h</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{isRenewal ? 'Horas Adicionais' : 'Horas'}</span>
                <span className="font-semibold text-slate-800">{packageData.hours}h</span>
              </div>
              {isRenewal && (
                <div className="flex justify-between bg-emerald-50 -mx-4 px-4 py-1 rounded">
                  <span className="font-bold text-emerald-700">Total de Horas</span>
                  <span className="font-bold text-emerald-700">{totalHoursAfterRenewal}h</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Data de Aquisição</span>
                <span className="font-semibold text-slate-800">{format(purchaseDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validade</span>
                <span className="font-semibold text-slate-800">{packageData.expiryDays || 90} dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expira em</span>
                <span className="font-semibold text-amber-600">{format(expirationDate, 'dd/MM/yyyy')}</span>
              </div>
              {employeeDiscount && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Desconto Colaborador</span>
                  <span className="font-semibold text-violet-600">50%</span>
                </div>
              )}
              <div className="flex justify-between border-t border-violet-200 pt-2 mt-1">
                <span className="font-bold text-slate-800">Total</span>
                <div className="text-right">
                  {employeeDiscount && (
                    <span className="text-sm text-slate-400 line-through mr-2">R$ {packageData.price.toFixed(2)}</span>
                  )}
                  <span className="text-xl font-bold text-emerald-600">R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Discount */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
            <div className="relative">
              <input type="checkbox" checked={employeeDiscount} onChange={(e) => setEmployeeDiscount(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-violet-500 transition-colors"></div>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-700">Desconto Colaborador</span>
              <span className="text-xs text-slate-400 ml-1.5">(50%)</span>
            </div>
          </label>

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
                  <div className="flex justify-center mb-1">{method === 'pix' ? <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> : <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}</div>
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
            {loading ? '⏳ Processando...' : `Confirmar R$ ${finalPrice.toFixed(2)}`}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default PackagePaymentModal;
