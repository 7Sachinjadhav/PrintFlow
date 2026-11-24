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
  HelpCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { UploadedFileItem, CalculatedOrderPrice } from '../../types';

interface PaymentPageProps {
  files: UploadedFileItem[];
  priceCalculation: CalculatedOrderPrice | null;
  customerPhone: string;
  customerName: string;
  orderNotes: string;
  setFiles: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
}

const UPI_ID = 'sjsachin242-1@okicici';
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
  const socket = useSocket();

  const [initializingOrder, setInitializingOrder] = useState(false);
  const [orderData, setOrderData] = useState<{ orderId: string; tokenNumber: string } | null>(null);
  const [orderStatus, setOrderStatus] = useState<'PENDING' | 'WAITING_CONFIRMATION' | 'PAID' | 'FAILED'>('PENDING');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [launchingCashfree, setLaunchingCashfree] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showManualUpi, setShowManualUpi] = useState(false);

  const orderCreatedRef = useRef(false);

  const handleCashfreePay = async (app?: string) => {
    if (!orderData?.orderId) {
      alert('Order is still preparing. Please wait 2 seconds and try again.');
      return;
    }
    setLaunchingCashfree(true);
    setSelectedApp(app || 'gateway');
    setErrorMsg(null);
    try {
      const res: any = await api.createCashfreeSession(orderData.orderId);
      const sessionId = res?.paymentSessionId || res?.data?.paymentSessionId;
      const upiLinks = res?.upiLinks || res?.data?.upiLinks;

      if (!sessionId) {
        throw new Error(res?.error || res?.message || 'Failed to obtain Cashfree payment session');
      }

      // 1. Direct synchronous Cashfree SDK checkout (Zero hanging, immediate redirect)
      let cf: any = null;
      if (typeof (window as any).Cashfree === 'function') {
        cf = (window as any).Cashfree({ mode: 'production' });
      } else {
        // Wait up to 1.5 seconds if script was still initializing
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (typeof (window as any).Cashfree === 'function') {
            cf = (window as any).Cashfree({ mode: 'production' });
            break;
          }
        }
      }

      if (cf && typeof cf.checkout === 'function') {
        cf.checkout({
          paymentSessionId: sessionId,
          redirectTarget: '_self',
        });
      } else {
        throw new Error('Cashfree gateway is initializing. Please tap again in a moment.');
      }
    } catch (err: any) {
      console.error('Cashfree launch error:', err);
      setErrorMsg(`Payment Gateway error: ${err.message}`);
    } finally {
      setLaunchingCashfree(false);
      setSelectedApp(null);
    }
  };

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

  // Pre-create the order on server so it is tracked in the Shopkeeper's Admin Dashboard
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

  // Real-time Socket.IO listener for instant approval from shopkeeper (Zero delay!)
  useEffect(() => {
    if (!socket || !orderData?.orderId) return;

    const channel = `order_${orderData.orderId}`;
    socket.emit('join_order', orderData.orderId);

    const handleStatusUpdate = (data: any) => {
      if (data.status === 'QUEUED' || data.status === 'PRINTING' || data.status === 'PAID') {
        setOrderStatus('PAID');
        setConfirmedToken(data.tokenNumber || orderData.tokenNumber);
        setFiles([]);

        // Automatically redirect to live token tracking in 1.5 seconds!
        setTimeout(() => {
          navigate(`/token/${orderData.orderId}`);
        }, 1500);
      } else if (data.status === 'PAYMENT_FAILED') {
        setOrderStatus('FAILED');
        setErrorMsg('Payment was not received by the shopkeeper. If debited, please show your PhonePe receipt at the counter.');
      }
    };

    socket.on('order_status_updated', handleStatusUpdate);

    // Also poll every 3 seconds as a robust backup
    const interval = setInterval(async () => {
      if (orderStatus === 'WAITING_CONFIRMATION') {
        try {
          const res = await api.getOrderStatus(orderData.orderId);
          if (res.status === 'QUEUED' || res.status === 'PAID') {
            handleStatusUpdate({ status: 'QUEUED', tokenNumber: orderData.tokenNumber });
          } else if (res.status === 'PAYMENT_FAILED') {
            handleStatusUpdate({ status: 'PAYMENT_FAILED' });
          }
        } catch (e) {}
      }
    }, 3000);

    return () => {
      socket.off('order_status_updated', handleStatusUpdate);
      clearInterval(interval);
    };
  }, [socket, orderData, orderStatus]);

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

  const handleLaunchApp = () => {
    setOrderStatus('WAITING_CONFIRMATION');
  };

  if (files.length === 0 && !confirmedToken && !orderData) {
    return null;
  }

  // 1. PAYMENT CONFIRMED SCREEN (Zomato/Flipkart style)
  if (orderStatus === 'PAID') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Bank Payment Verified</div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Payment Successful!</h2>
            <p className="text-sm text-slate-500 mt-1">₹{totalPayable.toFixed(2)} received by {UPI_NAME}</p>
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="text-[11px] font-bold text-indigo-700 uppercase">Your Print Token</div>
            <div className="text-3xl font-black text-indigo-900 font-mono tracking-tight mt-0.5">
              {confirmedToken}
            </div>
            <div className="text-xs text-indigo-600 mt-1 flex items-center justify-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sent automatically to Xerox queue!</span>
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

  // 2. WAITING FOR COUNTER CONFIRMATION SCREEN
  if (orderStatus === 'WAITING_CONFIRMATION') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <CustomerHeader />
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 flex flex-col items-center justify-center text-center space-y-5">
          <div className="relative">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Awaiting Counter Confirmation
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">Verifying Your Payment</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              The Xerox counter is checking the ₹{totalPayable.toFixed(2)} transfer. Your token will unlock automatically the moment it is confirmed!
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 w-full shadow-sm text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Token Reserved:</span>
              <span className="font-mono font-bold text-slate-900">{orderData?.tokenNumber}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Bill Amount:</span>
              <span className="font-bold text-slate-900">₹{totalPayable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Payee:</span>
              <span className="font-semibold text-slate-900">{UPI_NAME} ({UPI_ID})</span>
            </div>
          </div>

          <div className="space-y-2 w-full">
            <a
              href={phonePeLink}
              className="w-full py-3 px-4 bg-[#5f259f] hover:bg-[#521f8a] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
            >
              <span>Re-open PhonePe to Pay</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => setOrderStatus('PENDING')}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Choose another payment method
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 3. MAIN PAYMENT SCREEN
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Pay to Xerox Shop</h1>
          <p className="text-xs text-slate-500">Pay via PhonePe or GPay. Token is issued strictly upon confirmed payment.</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Amount Summary Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-3">
          <div className="flex justify-between items-center text-xs text-indigo-200">
            <span>Payee: <strong className="text-white">{UPI_NAME}</strong></span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Karnataka Vikas Grameena Bank
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <div>
              <div className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold">Total Bill Amount</div>
              <div className="text-3xl font-black tracking-tight text-white">₹{totalPayable.toFixed(2)}</div>
            </div>
            <div className="text-right text-xs text-indigo-200 font-medium">
              <div>VPA: <span className="font-mono text-white">{UPI_ID}</span></div>
              <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                {orderData?.tokenNumber ? `Reserved Token: ${orderData.tokenNumber}` : 'Preparing Order...'}
              </div>
            </div>
          </div>
        </div>

        {initializingOrder && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to Xerox counter...</span>
          </div>
        )}

        {/* 1-TAP INSTANT MOBILE UPI APPS (Karnataka Vikas Grameena Bank) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Tap Your App to Pay ₹{totalPayable.toFixed(2)}:
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Instant Open
            </span>
          </div>

          {/* 1. PhonePe Button (Instant 1-Tap App Launch) */}
          <a
            href={phonePeLink}
            onClick={handleLaunchApp}
            className="w-full p-4 rounded-xl border-2 border-purple-300 bg-purple-50/70 hover:bg-purple-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                पे
              </div>
              <div>
                <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>PhonePe</span>
                  <span className="text-[10px] font-bold text-[#5f259f] bg-purple-100 px-1.5 py-0.5 rounded">1-Tap Open</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Opens PhonePe directly • Pay ₹{totalPayable.toFixed(2)}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#5f259f] bg-purple-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 2. Google Pay (GPay) Button (Instant 1-Tap App Launch) */}
          <a
            href={gPayLink}
            onClick={handleLaunchApp}
            className="w-full p-4 rounded-xl border-2 border-blue-300 bg-blue-50/70 hover:bg-blue-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 text-lg shadow-md shrink-0">
                G<span className="text-emerald-500">P</span>
              </div>
              <div>
                <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>Google Pay (GPay)</span>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Fast</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Opens Google Pay directly • Pay ₹{totalPayable.toFixed(2)}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 3. Paytm / Cred / Universal UPI Button */}
          <a
            href={universalUpiLink}
            onClick={handleLaunchApp}
            className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] flex items-center justify-between transition group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Paytm / Cred / Other UPI</div>
                <div className="text-[10px] text-slate-500">Choose from all installed UPI apps on your phone</div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-200/60 px-2.5 py-1 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Open UPI <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>

        {/* QR Scanner Display */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Or Scan with Any UPI Camera (PhonePe / GPay / Paytm):
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-md inline-block">
              <img
                src={dynamicQrUrl}
                alt="Scan to Pay UPI QR"
                className="w-44 h-44 object-contain rounded-lg"
              />
            </div>
            <div className="mt-2 text-xs font-bold text-slate-800">
              Scan & pay <span className="text-indigo-600 font-black">₹{totalPayable.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              VPA: <strong className="text-slate-800">{UPI_ID}</strong> • {UPI_NAME}
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Direct UPI Transfer • Karnataka Vikas Grameena Bank</span>
        </div>

        {/* Optional Manual Counter UPI Backup (Collapsed) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowManualUpi(!showManualUpi)}
            className="text-[11px] text-slate-400 hover:text-slate-600 font-medium underline flex items-center justify-center gap-1 mx-auto"
          >
            <span>{showManualUpi ? 'Hide manual shop transfer' : 'Having issues with your bank? Pay manually to shopkeeper VPA'}</span>
          </button>

          {showManualUpi && (
            <div className="mt-3 bg-white rounded-2xl p-4 border border-amber-200 shadow-sm text-center space-y-3">
              <div className="text-xs font-bold text-amber-800">
                Direct Counter UPI (Requires Shopkeeper Manual Confirmation)
              </div>
              <div className="p-2 bg-white rounded-xl border border-dashed border-slate-300 inline-block">
                <img
                  src={dynamicQrUrl}
                  alt="Shopkeeper QR"
                  className="w-36 h-36 object-contain rounded"
                />
              </div>
              <div className="text-xs font-mono text-slate-600">
                VPA: {UPI_ID} • {UPI_NAME}
              </div>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                Note: Direct transfers to personal UPI may hit bank limits if paying from the same account. Use the buttons above for automatic printing.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
