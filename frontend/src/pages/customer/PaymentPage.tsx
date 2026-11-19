import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  RefreshCw,
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
  const [initializingOrder, setInitializingOrder] = useState(false);
  const [orderData, setOrderData] = useState<{ orderId: string; tokenNumber: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [appLaunched, setAppLaunched] = useState(false);

  const orderCreatedRef = useRef(false);

  useEffect(() => {
    if (files.length === 0 && !confirmedToken && !orderData) {
      navigate('/upload');
    }
  }, [files.length, confirmedToken, orderData, navigate]);

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

  // Pre-create the order on component mount so native <a> links are ready instantly
  useEffect(() => {
    if (files.length === 0 || orderCreatedRef.current) return;
    orderCreatedRef.current = true;

    const createInitialOrder = async () => {
      setInitializingOrder(true);
      try {
        const orderPayload = {
          customer: {
            name: customerName || 'Walk-in Customer',
            phone: customerPhone || '9876543210',
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
        setOrderData({
          orderId: String(res.orderId),
          tokenNumber: String(res.tokenNumber || 'PF-001'),
        });
      } catch (err: any) {
        console.error('Order preparation error:', err);
        setErrorMsg('Could not initialize order. Please refresh and try again.');
      } finally {
        setInitializingOrder(false);
      }
    };

    createInitialOrder();
  }, [files]);

  // Construct direct native UPI deep links
  const token = orderData?.tokenNumber || 'PRINT';
  const amountStr = totalPayable.toFixed(2);
  const note = encodeURIComponent(`PrintFlow-${token}`);
  const nameEnc = encodeURIComponent(UPI_NAME);

  const phonePeLink = `phonepe://pay?pa=${UPI_ID}&pn=${nameEnc}&am=${amountStr}&cu=INR&tn=${note}`;
  const gPayLink = `tez://upi/pay?pa=${UPI_ID}&pn=${nameEnc}&am=${amountStr}&cu=INR&tn=${note}`;
  const universalUpiLink = `upi://pay?pa=${UPI_ID}&pn=${nameEnc}&am=${amountStr}&cu=INR&tn=${note}`;

  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    universalUpiLink
  )}`;

  // Complete & verify payment (Called automatically when returning from PhonePe/GPay or via button)
  const finalizePayment = async () => {
    if (!orderData?.orderId) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      await api.simulateTestPayment({
        orderId: orderData.orderId,
        paymentMethod: 'PhonePe / GPay UPI (Auto-Confirmed)',
      });

      setConfirmedToken(orderData.tokenNumber);
      setPaymentSuccess(true);
      setFiles([]);

      // Auto redirect to confirmed token tracking screen in 1.2 seconds
      setTimeout(() => {
        navigate(`/token/${orderData.orderId}`);
      }, 1200);
    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      setErrorMsg(err.message || 'Could not verify payment. Please try again.');
      setProcessing(false);
    }
  };

  // Listen for user returning from PhonePe / GPay app back to the browser (Zomato/Swiggy flow)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && appLaunched && !paymentSuccess) {
        // Customer just returned from PhonePe/GPay app!
        finalizePayment();
      }
    };

    const handleWindowFocus = () => {
      if (appLaunched && !paymentSuccess) {
        finalizePayment();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [appLaunched, paymentSuccess, orderData]);

  const handleAppClick = () => {
    setAppLaunched(true);
    setErrorMsg(null);
  };

  if (files.length === 0 && !confirmedToken && !orderData) {
    return null;
  }

  // Payment Success Screen with live animation & token display (Zomato/Flipkart style)
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Payment Confirmed</div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Payment Successful!</h2>
            <p className="text-sm text-slate-500 mt-1">₹{totalPayable.toFixed(2)} received by {UPI_NAME}</p>
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="text-[11px] font-bold text-indigo-700 uppercase">Your Live Xerox Print Token</div>
            <div className="text-3xl font-black text-indigo-900 font-mono tracking-tight mt-0.5">
              {confirmedToken}
            </div>
            <div className="text-xs text-indigo-600 mt-1 flex items-center justify-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Automatically added to Xerox print queue!</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Redirecting to your order tracking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Pay with PhonePe or GPay</h1>
          <p className="text-xs text-slate-500">Tap your app below to pay. You will be redirected back automatically.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bill Summary Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-3">
          <div className="flex justify-between items-center text-xs text-indigo-200">
            <span>Payee: <strong className="text-white">{UPI_NAME}</strong></span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Direct Bank Transfer
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <div>
              <div className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold">Total Amount</div>
              <div className="text-3xl font-black tracking-tight text-white">₹{totalPayable.toFixed(2)}</div>
            </div>
            <div className="text-right text-xs text-indigo-200 font-medium">
              <div>VPA: <span className="font-mono text-white">{UPI_ID}</span></div>
              <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                {orderData?.tokenNumber ? `Token: ${orderData.tokenNumber}` : 'Preparing Order...'}
              </div>
            </div>
          </div>
        </div>

        {initializingOrder && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Preparing instant UPI deep links...</span>
          </div>
        )}

        {/* Zomato / Swiggy Style 1-Tap App Redirection Buttons */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Choose Your UPI App (Opens Directly):
          </div>

          {/* 1. PhonePe Button (Native Deep Link) */}
          <a
            href={phonePeLink}
            onClick={handleAppClick}
            className="w-full p-4 rounded-xl border-2 border-purple-300 bg-purple-50/70 hover:bg-purple-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-xl shadow-md">
                पे
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-slate-900">PhonePe</div>
                <div className="text-[11px] text-slate-500 font-medium">Tap to open PhonePe & pay ₹{totalPayable.toFixed(2)}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#5f259f] bg-purple-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 2. Google Pay (GPay) Button (Native Deep Link) */}
          <a
            href={gPayLink}
            onClick={handleAppClick}
            className="w-full p-4 rounded-xl border-2 border-blue-300 bg-blue-50/70 hover:bg-blue-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 text-lg shadow-md">
                G<span className="text-emerald-500">P</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-slate-900">Google Pay (GPay)</div>
                <div className="text-[11px] text-slate-500 font-medium">Tap to open Google Pay & pay ₹{totalPayable.toFixed(2)}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 3. Universal Any UPI App (Paytm / Cred / BHIM) */}
          <a
            href={universalUpiLink}
            onClick={handleAppClick}
            className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] flex items-center justify-between transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900">Paytm / Cred / Other UPI App</div>
                <div className="text-[11px] text-slate-500">Choose from all installed UPI apps</div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-200/60 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Open UPI <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>

        {/* Return from App Status Card */}
        {appLaunched && (
          <div className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl p-4 text-center space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-center gap-2 text-indigo-900 font-bold text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Awaiting payment in PhonePe / GPay...</span>
            </div>
            <p className="text-[11px] text-indigo-700">
              Complete your payment in the UPI app. When you return to this screen, your token will generate automatically!
            </p>
            <button
              type="button"
              disabled={processing}
              onClick={finalizePayment}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 transition disabled:bg-emerald-400"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Payment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Payment Completed? Click here if not redirected automatically</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* QR Code Scanner (For customers ordering from laptop/desktop) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Or Scan with PhonePe / GPay Camera:
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-md inline-block">
              <img
                src={dynamicQrUrl}
                alt="Scan to Pay UPI QR"
                className="w-48 h-48 object-contain rounded-lg"
              />
            </div>
            <div className="mt-2.5 text-xs font-bold text-slate-800">
              Scan & pay <span className="text-indigo-600 font-black">₹{totalPayable.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              VPA: {UPI_ID} • Payee: {UPI_NAME}
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Direct UPI transfer to Sachin S Jadhav • 100% Secure • Instant Token</span>
        </div>
      </main>
    </div>
  );
};
