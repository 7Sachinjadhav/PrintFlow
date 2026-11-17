import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { api } from '../../services/api';
import { UploadedFileItem, CalculatedOrderPrice } from '../../types';

interface PaymentPageProps {
  files: UploadedFileItem[];
  priceCalculation: CalculatedOrderPrice | null;
  customerPhone: string;
  customerName: string;
  orderNotes: string;
  setFiles: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  files,
  priceCalculation,
  customerPhone,
  customerName,
  orderNotes,
  setFiles,
}) => {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CARD' | 'SIMULATOR'>('UPI');

  if (files.length === 0 || !priceCalculation) {
    navigate('/upload');
    return null;
  }

  const handlePayment = async () => {
    setProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Create order on backend
      const orderPayload = {
        customer: {
          name: customerName || 'Walk-in Customer',
          phone: customerPhone || undefined,
        },
        items: files.map((f) => ({
          originalFilename: f.originalFilename,
          storedFilename: f.storedFilename,
          fileSizeBytes: f.fileSizeBytes,
          mimeType: f.mimeType,
          pageCount: f.pageCount,
          setting: f.setting,
        })),
        notes: orderNotes || undefined,
      };

      const orderRes = await api.createOrder(orderPayload);
      const { orderId, payment } = orderRes;

      // 2. Process payment
      // For development and test mode, verify through test sandbox
      const verifyRes = await api.simulateTestPayment({
        orderId,
        paymentMethod: selectedMethod === 'UPI' ? 'UPI / GPay' : 'Debit/Credit Card',
      });

      // Clear files in state after successful order submission
      setFiles([]);

      // 3. Navigate to Token Generation Success Screen
      navigate(`/token/${orderId}`);
    } catch (err: any) {
      console.error('Payment processing error:', err);
      setErrorMsg(err.message || 'Payment verification failed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Choose Payment Method</h1>
          <p className="text-xs text-slate-500">Fast & 100% secure payment gateway</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Amount Header Card */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-2xl p-5 text-white flex items-center justify-between shadow-md">
          <div>
            <span className="text-[11px] uppercase font-bold text-indigo-200 tracking-wider">Amount Payable</span>
            <div className="text-2xl font-black mt-0.5">₹{priceCalculation.totalAmount.toFixed(2)}</div>
            <div className="text-xs text-indigo-200 mt-1">{files.length} {files.length === 1 ? 'Document' : 'Documents'}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-indigo-200" />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2.5">
          <label
            onClick={() => setSelectedMethod('UPI')}
            className={`flex items-center justify-between p-4 rounded-2xl border bg-white cursor-pointer transition ${
              selectedMethod === 'UPI'
                ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">UPI / QR Code</div>
                <div className="text-[11px] text-slate-400">Google Pay, PhonePe, Paytm, BHIM</div>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Instant
            </span>
          </label>

          <label
            onClick={() => setSelectedMethod('CARD')}
            className={`flex items-center justify-between p-4 rounded-2xl border bg-white cursor-pointer transition ${
              selectedMethod === 'CARD'
                ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Debit / Credit Card</div>
                <div className="text-[11px] text-slate-400">Visa, Mastercard, RuPay</div>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-400">Supported</span>
          </label>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Server-verified payment signature • No card data saved</span>
        </div>

        {/* Action Button */}
        <div className="pt-3">
          <button
            type="button"
            disabled={processing}
            onClick={handlePayment}
            className="w-full py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition disabled:bg-indigo-400"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Payment & Generating Token...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Pay ₹{priceCalculation.totalAmount.toFixed(2)} & Get Print Token</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};
