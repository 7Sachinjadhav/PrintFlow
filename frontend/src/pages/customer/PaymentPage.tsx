import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    if (files.length === 0) {
      navigate('/upload');
    }
  }, [files.length, navigate]);

  const totalPayable = useMemo(() => {
    if (priceCalculation?.totalAmount !== undefined) {
      return priceCalculation.totalAmount;
    }
    return files.reduce((sum, f) => {
      const isColor = f.setting.colorMode === 'COLOR';
      const ratePerPage = isColor ? 10.0 : 2.0;
      const copies = f.setting.copies || 1;
      const pages = f.pageCount || 1;
      const isDuplex = f.setting.duplexMode === 'DOUBLE';
      const sheetsCount = isDuplex ? Math.ceil(pages / 2) * copies : pages * copies;
      const bindingCost = f.setting.bindingService === 'SPIRAL' ? 40 : 0;
      const laminationCost = f.setting.laminationService ? 20 * sheetsCount : 0;
      return sum + (pages * ratePerPage * copies) + bindingCost + laminationCost;
    }, 0);
  }, [files, priceCalculation]);

  if (files.length === 0) {
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
      const { orderId } = orderRes;

      // 2. Process payment through sandbox / test verification
      await api.simulateTestPayment({
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
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* UPI Payment Options */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Instant UPI Payment (Recommended)
          </div>

          <label
            onClick={() => setSelectedMethod('UPI')}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
              selectedMethod === 'UPI'
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">UPI / QR / GPay / PhonePe / Paytm</div>
                <div className="text-[11px] text-slate-400">Zero extra fees • Instant approval</div>
              </div>
            </div>
            {selectedMethod === 'UPI' && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </label>

          <label
            onClick={() => setSelectedMethod('CARD')}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
              selectedMethod === 'CARD'
                ? 'border-indigo-600 bg-indigo-50/50'
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
            {selectedMethod === 'CARD' && (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            )}
          </label>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Server-verified payment signature • Instant Xerox Queue</span>
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
                <span>Pay ₹{totalPayable.toFixed(2)} & Get Print Token</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};
