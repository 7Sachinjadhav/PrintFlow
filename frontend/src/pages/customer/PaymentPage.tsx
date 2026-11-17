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
  ExternalLink,
  Copy,
  Check,
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

const UPI_ID = '8073577702@ibl';
const UPI_NAME = 'SACHIN S JADHAV';

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
  const [createdOrder, setCreatedOrder] = useState<{ orderId: string; tokenNumber: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [activeTab, setActiveTab] = useState<'APP' | 'QR'>('APP');

  useEffect(() => {
    if (files.length === 0 && !createdOrder) {
      navigate('/upload');
    }
  }, [files.length, createdOrder, navigate]);

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
      return sum + pages * ratePerPage * copies + bindingCost + laminationCost;
    }, 0);
  }, [files, priceCalculation]);

  // Construct UPI deep links with exact amount and note
  const getUpiUrl = (appScheme: string = 'upi') => {
    const token = createdOrder?.tokenNumber || 'PRINT';
    const amountStr = totalPayable.toFixed(2);
    const note = encodeURIComponent(`PrintFlow-${token}`);
    const nameEnc = encodeURIComponent(UPI_NAME);

    if (appScheme === 'phonepe') {
      return `phonepe://pay?pa=${UPI_ID}&pn=${nameEnc}&mc=0000&mode=02&purpose=00&am=${amountStr}&cu=INR&tn=${note}`;
    }
    if (appScheme === 'gpay') {
      return `gpay://upi/pay?pa=${UPI_ID}&pn=${nameEnc}&mc=0000&mode=02&purpose=00&am=${amountStr}&cu=INR&tn=${note}`;
    }
    if (appScheme === 'paytm') {
      return `paytmmp://pay?pa=${UPI_ID}&pn=${nameEnc}&mc=0000&mode=02&purpose=00&am=${amountStr}&cu=INR&tn=${note}`;
    }
    return `upi://pay?pa=${UPI_ID}&pn=${nameEnc}&mc=0000&mode=02&purpose=00&am=${amountStr}&cu=INR&tn=${note}`;
  };

  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    getUpiUrl('upi')
  )}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Ensure order is created on server first, then redirect to UPI App
  const triggerAppPayment = async (app: 'phonepe' | 'gpay' | 'paytm' | 'upi') => {
    setProcessing(true);
    setErrorMsg(null);

    try {
      let orderId = createdOrder?.orderId;
      let tokenNumber = createdOrder?.tokenNumber;

      if (!orderId) {
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

        const res = await api.createOrder(orderPayload);
        orderId = String(res.orderId);
        tokenNumber = String(res.tokenNumber || 'PRINT');
        setCreatedOrder({ orderId, tokenNumber });
      }

      const upiLink = getUpiUrl(app);

      // Trigger UPI app redirection on mobile device
      window.location.href = upiLink;
    } catch (err: any) {
      console.error('Order creation error:', err);
      setErrorMsg(err.message || 'Could not initiate payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Finalize order after payment in UPI app
  const handleConfirmPaid = async () => {
    setProcessing(true);
    setErrorMsg(null);

    try {
      let orderId = createdOrder?.orderId;

      if (!orderId) {
        // Create order if not already created
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
        const res = await api.createOrder(orderPayload);
        orderId = res.orderId;
      }

      // Mark payment as verified
      await api.simulateTestPayment({
        orderId,
        paymentMethod: 'PhonePe / GPay UPI',
      });

      // Clear uploaded files from state
      setFiles([]);

      // Navigate to Token Success Screen
      navigate(`/token/${orderId}`);
    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      setErrorMsg(err.message || 'Could not confirm payment. Please try again.');
      setProcessing(false);
    }
  };

  if (files.length === 0 && !createdOrder) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl font-black text-slate-900">Pay via PhonePe / GPay</h1>
          <p className="text-xs text-slate-500">Scan QR or tap your UPI app to pay directly to shop</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Amount Summary Card */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-3">
          <div className="flex justify-between items-center text-xs text-indigo-200">
            <span>Payee: <strong className="text-white">{UPI_NAME}</strong></span>
            <span className="bg-indigo-700/60 px-2 py-0.5 rounded-full font-mono text-[11px]">
              {createdOrder?.tokenNumber ? `Token: ${createdOrder.tokenNumber}` : 'New Order'}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <div>
              <div className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold">Total Amount</div>
              <div className="text-3xl font-black tracking-tight text-white">₹{totalPayable.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={handleCopyUpi}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono transition text-indigo-100"
              >
                <span>{UPI_ID}</span>
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="text-[10px] text-indigo-300 mt-1">Tap to copy UPI ID</div>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs (UPI App vs QR Scanner) */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('APP')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'APP'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Pay with UPI Apps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QR')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'QR'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {/* TAB 1: 1-Tap Mobile UPI App Buttons */}
        {activeTab === 'APP' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tap your preferred UPI app:
            </div>

            {/* PhonePe Button */}
            <button
              type="button"
              disabled={processing}
              onClick={() => triggerAppPayment('phonepe')}
              className="w-full p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 active:scale-[0.99] flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  पे
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">PhonePe</div>
                  <div className="text-[11px] text-slate-500">Pay directly with PhonePe app</div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#5f259f] flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Google Pay Button */}
            <button
              type="button"
              disabled={processing}
              onClick={() => triggerAppPayment('gpay')}
              className="w-full p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 active:scale-[0.99] flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 text-base shadow-sm">
                  G<span className="text-emerald-500">P</span>
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Google Pay (GPay)</div>
                  <div className="text-[11px] text-slate-500">Instant UPI payment on Google Pay</div>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Paytm / Default UPI Button */}
            <button
              type="button"
              disabled={processing}
              onClick={() => triggerAppPayment('upi')}
              className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.99] flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Paytm / Cred / Any UPI App</div>
                  <div className="text-[11px] text-slate-500">Choose any installed UPI app</div>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        )}

        {/* TAB 2: PhonePe QR Scanner for Desktop/PC or scanning with another phone */}
        {activeTab === 'QR' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 text-[#5f259f] rounded-full text-xs font-bold">
              <span>PhonePe • GPay • Paytm Accepted</span>
            </div>

            {/* QR Image with exact amount */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-md inline-block">
                <img
                  src={dynamicQrUrl}
                  alt="Scan to Pay UPI QR"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              </div>
              <div className="mt-3 text-xs font-bold text-slate-800">
                Scan with any UPI App camera to pay <span className="text-indigo-600 font-black">₹{totalPayable.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                VPA: {UPI_ID} ({UPI_NAME})
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Step: Once paid in app, click to get token */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-emerald-900">After completing payment in PhonePe / GPay:</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Click the button below to generate your Xerox Print Token and queue your documents!
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={handleConfirmPaid}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-2 transition disabled:bg-emerald-400"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirming Order & Generating Token...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>I Have Paid ₹{totalPayable.toFixed(2)} → Get Print Token</span>
              </>
            )}
          </button>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Direct UPI transfer to Sachin S Jadhav ({UPI_ID}) • 100% Secure</span>
        </div>
      </main>
    </div>
  );
};
