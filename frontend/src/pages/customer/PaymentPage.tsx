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
  Lock,
  Receipt,
  HelpCircle,
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
  const [utrNumber, setUtrNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [activeTab, setActiveTab] = useState<'APP' | 'QR'>('APP');
  const [showUtrHelp, setShowUtrHelp] = useState(false);

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

  // Launch PhonePe / GPay app
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
      window.location.href = upiLink;
    } catch (err: any) {
      console.error('Order creation error:', err);
      setErrorMsg(err.message || 'Could not initiate payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Verify Real Payment with 12-digit UTR
  const handleVerifyUtr = async () => {
    const cleanUtr = utrNumber.trim().replace(/\s+/g, '');
    if (cleanUtr.length < 12) {
      setErrorMsg('Please enter the full 12-digit UPI Reference / UTR Number from your payment receipt.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      let orderId = createdOrder?.orderId;

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
      }

      // Verify 12-digit UTR with backend (checks anti-duplicate fraud)
      await api.submitUtrPayment({
        orderId,
        utrNumber: cleanUtr,
        upiApp: 'PhonePe / GPay',
      });

      // Clear uploaded files from state
      setFiles([]);

      // Navigate to Token Success Screen
      navigate(`/token/${orderId}`);
    } catch (err: any) {
      console.error('UTR verification error:', err);
      setErrorMsg(err.message || 'UTR verification failed. Please ensure the 12-digit number is correct.');
      setProcessing(false);
    }
  };

  if (files.length === 0 && !createdOrder) {
    return null;
  }

  const isUtrValid = utrNumber.trim().replace(/\s+/g, '').length >= 12;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Pay & Verify Order</h1>
          <p className="text-xs text-slate-500">Pay to Xerox shop UPI and enter your 12-digit UTR to get your token</p>
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
            <span>Shop Account: <strong className="text-white">{UPI_NAME}</strong></span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Fraud Protected
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <div>
              <div className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold">Total Payable</div>
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
            <span>Step 1: Pay with App</span>
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
            <span>Step 1: Scan QR</span>
          </button>
        </div>

        {/* Step 1A: 1-Tap Mobile UPI App Buttons */}
        {activeTab === 'APP' && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Step 1: Open UPI App & Pay ₹{totalPayable.toFixed(2)}
            </div>

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
                  <div className="text-[11px] text-slate-500">Auto-fills ₹{totalPayable.toFixed(2)} to {UPI_NAME}</div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#5f259f] flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>

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
                  <div className="text-[11px] text-slate-500">Auto-fills ₹{totalPayable.toFixed(2)} to {UPI_NAME}</div>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>

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
                  <div className="text-xs font-bold text-slate-900">Paytm / Cred / Other UPI</div>
                  <div className="text-[11px] text-slate-500">Choose any installed UPI app</div>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                Pay ₹{totalPayable.toFixed(2)} <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        )}

        {/* Step 1B: Scan QR Code */}
        {activeTab === 'QR' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 text-[#5f259f] rounded-full text-xs font-bold">
              <span>PhonePe • GPay • Paytm Accepted</span>
            </div>

            <div className="flex flex-col items-center justify-center py-2">
              <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-md inline-block">
                <img
                  src={dynamicQrUrl}
                  alt="Scan to Pay UPI QR"
                  className="w-52 h-52 object-contain rounded-lg"
                />
              </div>
              <div className="mt-3 text-xs font-bold text-slate-800">
                Scan with any UPI App to pay <span className="text-indigo-600 font-black">₹{totalPayable.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                VPA: {UPI_ID} ({UPI_NAME})
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MANDATORY 12-DIGIT UTR VERIFICATION (NO FAKE BYPASS) */}
        <div className="bg-white rounded-2xl p-5 border-2 border-indigo-500 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                2
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                Enter 12-Digit UPI Reference / UTR
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
              <p className="font-bold">📱 How to find your 12-digit UTR:</p>
              <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                <li><strong>PhonePe:</strong> Open payment receipt → look for <em>"UTR"</em> or <em>"Debited from"</em> 12-digit number (e.g. <code>432190876543</code>).</li>
                <li><strong>Google Pay:</strong> Tap transaction → copy the 12-digit <em>"UPI transaction ID"</em>.</li>
                <li><strong>Paytm:</strong> Tap transaction → copy the 12-digit <em>"UPI Ref No"</em>.</li>
              </ul>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
              12-Digit UPI Transaction ID / UTR Number: <span className="text-rose-500">*</span>
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
              <span>Required to verify bank credit before printing</span>
              <span className={isUtrValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                {utrNumber.trim().replace(/\s+/g, '').length}/12 digits
              </span>
            </div>
          </div>

          {/* Secure Verification Action Button */}
          <button
            type="button"
            disabled={!isUtrValid || processing}
            onClick={handleVerifyUtr}
            className="w-full py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying UTR & Generating Print Token...</span>
              </>
            ) : isUtrValid ? (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Verify Payment & Generate Token (₹{totalPayable.toFixed(2)})</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Enter 12-Digit UTR to Unlock Print Token</span>
              </>
            )}
          </button>
        </div>

        {/* Security Assurance */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Payment verified directly with Xerox counter • Zero false orders</span>
        </div>
      </main>
    </div>
  );
};
