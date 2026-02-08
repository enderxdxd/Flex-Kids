import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Child, Customer } from '../../../../shared/types';
import { paymentsServiceOffline } from '../../../../shared/firebase/services/payments.service.offline';
import { packagesServiceOffline } from '../../../../shared/firebase/services/packages.service.offline';

interface PackagePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  packageData: {
    customerId: string;
    childId: string;
    type: string;
    hours: number;
    price: number;
    expiryDays?: number;
  };
  child: Child;
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'pix'>('pix');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirmPayment = async () => {
    try {
      setLoading(true);

      // 1. Criar o pagamento primeiro
      const payment = await paymentsServiceOffline.createPayment({
        customerId: customer.id,
        childId: child.id,
        childName: child.name,
        amount: packageData.price,
        method: paymentMethod,
        status: 'paid',
        type: 'package',
        description: `${packageData.type} - ${child.name}`,
      });

      // 2. Só após pagamento confirmado, criar o pacote
      await packagesServiceOffline.createPackage({
        ...packageData,
        usedHours: 0,
        active: true,
        sharedAcrossUnits: true,
        paymentId: payment.id, // Vincula ao pagamento
      });

      toast.success('✅ Pagamento confirmado e pacote ativado!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return '💵';
      case 'card': return '💳';
      case 'pix': return '📱';
      default: return '💰';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            💳 Pagamento do Pacote
          </h2>
          <p className="text-green-100 mt-1">Confirme o pagamento para ativar o pacote</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Resumo do Pacote */}
          <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
            <h3 className="font-bold text-purple-800 mb-3">📦 Resumo do Pacote</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Criança:</span>
                <span className="font-bold text-gray-800">{child.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Responsável:</span>
                <span className="font-bold text-gray-800">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pacote:</span>
                <span className="font-bold text-gray-800">{packageData.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Horas:</span>
                <span className="font-bold text-gray-800">{packageData.hours}h</span>
              </div>
              <div className="flex justify-between border-t border-purple-200 pt-2 mt-2">
                <span className="text-lg font-bold text-gray-800">Total:</span>
                <span className="text-2xl font-bold text-green-600">
                  R$ {packageData.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              💳 Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['pix', 'card', 'cash'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-4 rounded-xl transition-all border-2 ${
                    paymentMethod === method
                      ? 'border-green-500 bg-green-50 shadow-lg'
                      : 'border-gray-200 hover:border-green-300 bg-white'
                  }`}
                >
                  <div className="text-3xl mb-2">{getPaymentMethodIcon(method)}</div>
                  <div className="font-semibold text-sm">
                    {method === 'pix' ? 'PIX' : method === 'card' ? 'Cartão' : 'Dinheiro'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-bold">⚠️ Importante:</span> O pacote só será ativado após a confirmação do pagamento.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-all font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl hover:opacity-90 transition-all font-bold shadow-lg disabled:opacity-50"
          >
            {loading ? '⏳ Processando...' : `✓ Confirmar R$ ${packageData.price.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackagePaymentModal;
