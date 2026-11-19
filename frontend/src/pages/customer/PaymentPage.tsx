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
  const [orderData, setOrderData] = useState<{ orderId: string; tokenNumber: string; payment?: any } | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [appLaunched, setAppLaunched] = useState(false);
  const [showUtrHelp, setShowUtrHelp] = useState(false);

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

  // Pre-create the order on server so it is tracked with status: PAYMENT_PENDING
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
          payment: res.payment,
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

  // Automated Payment Gateway Checkout (Real Zomato/Amazon flow)
  const handleGatewayCheckout = () => {
    if (!orderData?.orderId || !orderData.payment?.keyId) return;

    const payment = orderData.payment;

    if (typeof window.Razorpay === 'function' && !payment.keyId.includes('rzp_test_PrintFlow123')) {
      // Real Razorpay Gateway Configured
      const options = {
        key: payment.keyId,
        amount: Math.round(totalPayable * 100),
        currency: 'INR',
        name: 'PrintFlow Express Xerox',
        description: `Order #${orderData.tokenNumber}`,
        order_id: payment.razorpayOrderId.startsWith('order_') ? payment.razorpayOrderId : undefined,
        prefill: {
          name: customerName || 'Customer',
          contact: customerPhone || '9876543210',
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async function (response: any) {
          // BANK CONFIRMED (Money in owner's account)
          try {
            setProcessing(true);
            await api.verifyPayment({
              orderId: orderData.orderId,
              razorpayOrderId: response.razorpay_order_id || payment.razorpayOrderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentMethod: 'Razorpay UPI Gateway',
            });

            setConfirmedToken(orderData.tokenNumber);
            setPaymentSuccess(true);
            setFiles([]);

            setTimeout(() => {
              navigate(`/token/${orderData.orderId}`);
            }, 1200);
          } catch (err: any) {
            setErrorMsg(err.message || 'Payment verification failed on server.');
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setErrorMsg(resp.error?.description || 'Payment was cancelled or failed. No token generated.');
        setProcessing(false);
      });
      rzp.open();
    }
  };

  // Real UTR Verification (Prevents unauthorized token generation without paying!)
  const handleVerifyUtr = async () => {
    if (!orderData?.orderId) return;
    const cleanUtr = utrNumber.trim().replace(/\s+/g, '');

    if (cleanUtr.length < 12) {
      setErrorMsg('Please enter the 12-digit UPI Reference / UTR Number from your payment receipt.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      // Validate UTR with backend (strictly prevents fake bypass or duplicate UTR re-use)
      await api.submitUtrPayment({
        orderId: orderData.orderId,
        utrNumber: cleanUtr,
        upiApp: 'PhonePe / GPay',
      });

      setConfirmedToken(orderData.tokenNumber);
      setPaymentSuccess(true);
      setFiles([]);

      setTimeout(() => {
        navigate(`/token/${orderData.orderId}`);
      }, 1200);
    } catch (err: any) {
      console.error('UTR verification error:', err);
      setErrorMsg(err.message || 'Invalid UTR or already used. Please check your PhonePe receipt.');
      setProcessing(false);
    }
  };

  const isUtrValid = utrNumber.trim().replace(/\s+/g, '').length >= 12;

  if (files.length === 0 && !confirmedToken && !orderData) {
    return null;
  }

  // Payment Success Screen with live animation & token display
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Payment Confirmed & Verified</div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Payment Successful!</h2>
            <p className="text-sm text-slate-500 mt-1">₹{totalPayable.toFixed(2)} credited to {UPI_NAME}</p>
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="text-[11px] font-bold text-indigo-700 uppercase">Your Verified Print Token</div>
            <div className="text-3xl font-black text-indigo-900 font-mono tracking-tight mt-0.5">
              {confirmedToken}
            </div>
            <div className="text-xs text-indigo-600 mt-1 flex items-center justify-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Released to Xerox print queue!</span>
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
          <h1 className="text-xl font-black text-slate-900">Pay to Shop Xerox</h1>
          <p className="text-xs text-slate-500">Pay via PhonePe or GPay. Token is issued ONLY upon confirmed payment.</p>
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
              <Lock className="w-3 h-3" /> Fraud Protected
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <div>
              <div className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold">Total Bill Amount</div>
              <div className="text-3xl font-black tracking-tight text-white">₹{totalPayable.toFixed(2)}</div>
            </div>
            <div className="text-right text-xs text-indigo-200 font-medium">
              <div>VPA: <span className="font-mono text-white">{UPI_ID}</span></div>
              <div className="text-[11px] text-amber-300 font-bold mt-0.5 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" />
                <span>Token locked until paid</span>
              </div>
            </div>
          </div>
        </div>

        {initializingOrder && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Preparing order...</span>
          </div>
        )}

        {/* STEP 1: Direct App Redirection Buttons */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">1</span>
            <span>Tap to Pay ₹{totalPayable.toFixed(2)} in your app:</span>
          </div>

          {/* 1. PhonePe Button */}
          <a
            href={phonePeLink}
            onClick={() => setAppLaunched(true)}
            className="w-full p-4 rounded-xl border-2 border-purple-300 bg-purple-50/70 hover:bg-purple-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-xl shadow-md">
                पे
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-slate-900">PhonePe</div>
                <div className="text-[11px] text-slate-500 font-medium">Opens PhonePe directly with ₹{totalPayable.toFixed(2)}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#5f259f] bg-purple-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 2. Google Pay Button */}
          <a
            href={gPayLink}
            onClick={() => setAppLaunched(true)}
            className="w-full p-4 rounded-xl border-2 border-blue-300 bg-blue-50/70 hover:bg-blue-100 active:scale-[0.98] flex items-center justify-between transition group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 text-lg shadow-md">
                G<span className="text-emerald-500">P</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-slate-900">Google Pay (GPay)</div>
                <div className="text-[11px] text-slate-500 font-medium">Opens Google Pay directly with ₹{totalPayable.toFixed(2)}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Pay Now <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          {/* 3. Universal UPI App */}
          <a
            href={universalUpiLink}
            onClick={() => setAppLaunched(true)}
            className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] flex items-center justify-between transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">Paytm / Cred / Other UPI</div>
                <div className="text-[10px] text-slate-500">Choose from all installed UPI apps</div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-200/60 px-2.5 py-1 rounded-lg flex items-center gap-1 group-hover:translate-x-0.5 transition">
              Open UPI <ExternalLink className="w-3 h-3" />
            </span>
          </a>
        </div>

        {/* STEP 2: MANDATORY PAYMENT VERIFICATION (PROTECTS THE OWNER FROM LOSS) */}
        <div className="bg-white rounded-2xl p-5 border-2 border-indigo-500 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                2
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                Confirm Payment & Unlock Token:
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUtrHelp(!showUtrHelp)}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Where is UTR?</span>
            </button>
          </div>

          {showUtrHelp && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 space-y-1">
              <p className="font-bold">📱 How to find your 12-digit UPI UTR Number:</p>
              <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                <li><strong>PhonePe:</strong> Open payment receipt ➡️ copy the 12-digit number next to <em>"UTR"</em>.</li>
                <li><strong>Google Pay:</strong> Open payment receipt ➡️ copy the 12-digit <em>"UPI transaction ID"</em>.</li>
                <li><strong>Paytm:</strong> Look for the 12-digit <em>"UPI Ref No"</em>.</li>
              </ul>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
              Enter 12-Digit UPI Reference / UTR Number: <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={16}
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. 432109876543"
                className="w-full text-sm font-mono tracking-wider px-3.5 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
              {isUtrValid && (
                <div className="absolute right-3 top-3 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
              <span>Token is released ONLY after valid 12-digit UTR is entered</span>
              <span className={isUtrValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {utrNumber.trim().replace(/\s+/g, '').length}/12 digits
              </span>
            </div>
          </div>

          {/* Action Button - STRICTLY LOCKED UNTIL 12 DIGITS ENTERED */}
          <button
            type="button"
            disabled={!isUtrValid || processing}
            onClick={handleVerifyUtr}
            className="w-full py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Payment with Server...</span>
              </>
            ) : isUtrValid ? (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Confirm Payment & Release Print Token</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Enter 12-Digit UTR to Release Token</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic QR for Desktop Scanning */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Or Scan with PhonePe / GPay Camera:
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
            <div className="text-[10px] text-slate-400 font-mono">
              VPA: {UPI_ID} • Payee: {UPI_NAME}
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Zero False Orders Guarantee • Direct Bank Credit to Sachin S Jadhav</span>
        </div>
      </main>
    </div>
  );
};
