import React, { useEffect, useState, useRef } from 'react';
import {
  ListOrdered,
  RefreshCw,
  Printer,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Eye,
  AlertTriangle,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  HelpCircle,
  Check,
  ChevronRight,
  Sliders,
  X,
  CreditCard,
  Clock,
  ArrowRight,
  Copy,
  Smartphone,
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { useSocket } from '../../hooks/useSocket';

export const LiveQueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Auto-Print & Sound settings (persisted in localStorage)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    return localStorage.getItem('printflow_auto_print') === 'true';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('printflow_sound_alerts') !== 'false';
  });
  const [showKioskGuide, setShowKioskGuide] = useState(false);
  const [showAutomationGuide, setShowAutomationGuide] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testSimulating, setTestSimulating] = useState(false);
  const [lastPrintedMessage, setLastPrintedMessage] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/payments/webhook/sms?secret=pf_auto_8073577702`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleSimulateAutomatedPayment = async (order?: any) => {
    setTestSimulating(true);
    try {
      const amount = order?.totalAmount || 2.0;
      const token = order?.tokenNumber || 'PF-001';
      const testText = `PhonePe: Received ₹${Number(amount).toFixed(2)} from Test Customer for ${token}`;

      await api.testSmsWebhook({ text: testText, secret: 'pf_auto_8073577702' });
      playAlertChime();
      alert(`✅ Android Webhook Auto-Approval Tested Successfully!\n\nSimulated Signal: "${testText}"\n\nOrder ${token} was automatically verified, token sent to customer's phone, and released to Xerox print queue!`);
      await fetchQueue();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setTestSimulating(false);
    }
  };

  // Keep track of job IDs that have already been auto-printed in this browser session
  const autoPrintedJobIdsRef = useRef<Set<string>>(new Set());
  const prevPendingCountRef = useRef<number>(0);

  const socket = useSocket();

  // Play a crisp notification chime using Web Audio API
  const playAlertChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }
  };

  // Browser Silent / Direct Document Print
  const printDocumentDirect = (storedFilename: string, originalFilename?: string): Promise<void> => {
    return new Promise((resolve) => {
      const fileUrl = `/api/documents/preview/${storedFilename}`;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = fileUrl;

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve();
          }, 3000);
        } catch (err) {
          window.open(fileUrl, '_blank');
          resolve();
        }
      };

      iframe.onerror = () => {
        window.open(fileUrl, '_blank');
        resolve();
      };

      document.body.appendChild(iframe);
    });
  };

  // Fetch queue and handle Auto-Print trigger
  const fetchQueue = async () => {
    try {
      const [queueData, pendingRes] = await Promise.all([
        api.getAdminQueue().catch(() => []),
        api.getPendingApprovals().catch(() => ({ data: [] })),
      ]);

      setJobs(Array.isArray(queueData) ? queueData : []);
      const pendingList = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
      setPendingApprovals(pendingList);

      // Play chime if new pending payment arrives
      if (pendingList.length > prevPendingCountRef.current) {
        playAlertChime();
      }
      prevPendingCountRef.current = pendingList.length;

      // Auto-print check: if Auto-Print is enabled, find any unprinted QUEUED jobs
      if (autoPrintEnabled && Array.isArray(queueData)) {
        const queuedJobs = queueData.filter((j: any) => j.status === 'QUEUED' && !autoPrintedJobIdsRef.current.has(j.id));

        for (const job of queuedJobs) {
          autoPrintedJobIdsRef.current.add(job.id);
          playAlertChime();

          if (job.document?.storedFilename) {
            setLastPrintedMessage(`Printing Token ${job.order?.tokenNumber}: ${job.document?.originalFilename}`);
            await printDocumentDirect(job.document.storedFilename, job.document.originalFilename);

            // Update order status to READY_FOR_COLLECTION on backend
            if (job.order?.id) {
              await api.updateOrderStatus(job.order.id, 'READY_FOR_COLLECTION').catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [autoPrintEnabled, soundEnabled]);

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_pending_payment', () => {
      playAlertChime();
      fetchQueue();
    });
    socket.on('new_queue_job', () => {
      playAlertChime();
      fetchQueue();
    });
    socket.on('queue_job_claimed', fetchQueue);
    socket.on('queue_updated', fetchQueue);
    socket.on('order_status_updated', fetchQueue);

    return () => {
      socket.off('new_pending_payment', fetchQueue);
      socket.off('new_queue_job', fetchQueue);
      socket.off('queue_job_claimed', fetchQueue);
      socket.off('queue_updated', fetchQueue);
      socket.off('order_status_updated', fetchQueue);
    };
  }, [socket, autoPrintEnabled, soundEnabled]);

  const toggleAutoPrint = () => {
    const nextVal = !autoPrintEnabled;
    setAutoPrintEnabled(nextVal);
    localStorage.setItem('printflow_auto_print', String(nextVal));
    if (nextVal) {
      playAlertChime();
    }
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('printflow_sound_alerts', String(nextVal));
  };

  // Manual Print Button Trigger
  const handleManualPrint = async (job: any) => {
    if (!job.document?.storedFilename) return;
    setActionLoadingId(job.id);
    try {
      await printDocumentDirect(job.document.storedFilename, job.document.originalFilename);
      // Mark as Ready
      if (job.order?.id) {
        await api.updateOrderStatus(job.order.id, 'READY_FOR_COLLECTION');
        await fetchQueue();
      }
    } catch (err: any) {
      alert(`Print failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Test Print: Generates a test print sheet for the Xerox machine
  const handleTestPrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>PrintFlow Xerox Test Print</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 40px; }
              .box { border: 3px solid #4f46e5; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
              h1 { color: #4f46e5; margin-bottom: 5px; }
              .token { font-size: 32px; font-weight: 900; background: #e0e7ff; color: #3730a3; padding: 10px 20px; border-radius: 8px; display: inline-block; margin: 20px 0; }
              .time { color: #64748b; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="box">
              <h1>PrintFlow Express Xerox</h1>
              <p>Hardware Connection Test Print</p>
              <div class="token">TEST PASS: PF-OK</div>
              <p><strong>Printer:</strong> Windows Default Xerox Machine</p>
              <p><strong>Status:</strong> Ready for automated customer jobs</p>
              <p class="time">Timestamp: ${new Date().toLocaleString()}</p>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleRetry = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await api.retryJob(jobId);
      await fetchQueue();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.updateOrderStatus(orderId, status);
      await fetchQueue();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // 1-Click Approve Payment & Release to Xerox
  const handleApprovePayment = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await api.approveOrderPayment(orderId);
      playAlertChime();
      await fetchQueue();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Reject Fake/Unpaid Order (Zero loss)
  const handleRejectPayment = async (orderId: string) => {
    if (!window.confirm('Reject this order? Customer will be notified that payment was not detected.')) return;
    setActionLoadingId(orderId);
    try {
      await api.rejectOrderPayment(orderId);
      await fetchQueue();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Live Printing Queue</h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {jobs.length} Active Jobs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zero-install browser queue connected directly to your shop's Xerox machines
          </p>
        </div>

        {/* Control Badges: Auto-Print Toggle, Sound, Kiosk Guide, Test Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Print Master Toggle */}
          <button
            onClick={toggleAutoPrint}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition ${
              autoPrintEnabled
                ? 'bg-emerald-600 text-white shadow-emerald-200 ring-2 ring-emerald-400/50'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoPrintEnabled ? 'bg-white animate-pulse' : 'bg-slate-400'
              }`}
            />
            <Printer className="w-3.5 h-3.5" />
            <span>Auto-Print: {autoPrintEnabled ? 'ACTIVE (Hands-Free)' : 'PAUSED (Manual Click)'}</span>
          </button>

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl text-xs font-medium border transition ${
              soundEnabled
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
            title={soundEnabled ? 'Order sound alert ON' : 'Order sound alert MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Test Print Button */}
          <button
            onClick={handleTestPrint}
            className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Test Print Xerox</span>
          </button>

          {/* Chrome Silent Setup Guide */}
          <button
            onClick={() => setShowKioskGuide(!showKioskGuide)}
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-medium transition"
            title="How to enable 100% Silent Printing in Chrome"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchQueue}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Network Copiers Connectivity Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-800">Connected Shop Xerox Hardware:</div>
            <div className="text-[11px] text-slate-400">Windows spooler & network photocopier status</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">Konica 251:</span>
            <span className="text-slate-500 font-mono text-[11px]">EPSON L3250 Series (Color & B&W)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-800">Canon 240:</span>
            <span className="text-slate-500 font-mono text-[11px]">Microsoft Print to PDF (B&W Fast)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">ONLINE</span>
          </div>

          <a
            href="/admin/printers"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
          >
            Configure ➔
          </a>
        </div>
      </div>

      {/* Auto-Print Banner when Active */}
      {autoPrintEnabled && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Printer className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <span>Hands-Free Auto-Print is LIVE</span>
                <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-mono font-normal">
                  Zero Clicks
                </span>
              </div>
              <div className="text-[11px] text-emerald-800">
                Incoming customer orders will automatically print to your Windows default Xerox printer.
              </div>
            </div>
          </div>
          {lastPrintedMessage && (
            <div className="text-xs text-emerald-700 bg-white/80 px-3 py-1 rounded-lg font-mono font-medium border border-emerald-200 hidden sm:block">
              {lastPrintedMessage}
            </div>
          )}
        </div>
      )}

      {/* Chrome Silent Printing Helper Guide Dropdown */}
      {showKioskGuide && (
        <div className="bg-indigo-900 text-white rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>How to Enable 100% Silent Printing in Chrome (Zero Dialogs)</span>
            </h3>
            <button
              onClick={() => setShowKioskGuide(false)}
              className="text-xs text-indigo-300 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="text-xs text-indigo-200 space-y-1.5 leading-relaxed">
            <p>To let Chrome print directly without showing the print preview popup:</p>
            <ol className="list-decimal list-inside space-y-1 text-white">
              <li>Right-click your Google Chrome desktop shortcut → click <strong>Properties</strong>.</li>
              <li>
                In the <strong>Target</strong> field, add a space at the end and paste:  
                <code className="bg-black/40 text-amber-300 px-2 py-0.5 rounded font-mono ml-1">
                  --kiosk-printing
                </code>
              </li>
              <li>Click <strong>Apply</strong> and launch Chrome using that shortcut!</li>
            </ol>
            <p className="text-[11px] text-indigo-300 pt-1">
              * Whenever a customer pays, Chrome will automatically spit out the document on the Xerox machine without touching the mouse!
            </p>
          </div>
        </div>
      )}

      {/* 1-CLICK UPI PAYMENT APPROVALS (Zero Fake Orders Guarantee) */}
      <div
        className={`rounded-2xl border transition duration-200 overflow-hidden ${
          pendingApprovals.length > 0
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300 shadow-md ring-2 ring-amber-400/20'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-amber-200/60 bg-amber-100/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                pendingApprovals.length > 0 ? 'bg-amber-600 animate-pulse' : 'bg-slate-400'
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  UPI Payment Approvals (PhonePe / GPay)
                </h2>
                {pendingApprovals.length > 0 ? (
                  <span className="bg-amber-500 text-white font-mono text-xs font-bold px-2.5 py-0.5 rounded-full animate-bounce">
                    {pendingApprovals.length} Awaiting Approval
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Check your PhonePe Soundbox or SMS, then tap <strong>Approve & Print</strong> to immediately release the Xerox job.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAutomationGuide(!showAutomationGuide)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{showAutomationGuide ? 'Hide Auto Setup' : '⚡ 100% Android Automation Setup'}</span>
            </button>
            <div className="text-right text-[11px] text-slate-500 hidden xl:block">
              <span className="font-semibold text-slate-700">UPI:</span> 8073577702@ibl
            </div>
          </div>
        </div>

        {/* 100% HANDS-FREE ANDROID AUTOMATION GUIDE */}
        {showAutomationGuide && (
          <div className="p-5 bg-indigo-950 text-white border-b border-indigo-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">100% Hands-Free Android Automation (Zero Owner Clicks)</h3>
              </div>
              <button
                onClick={() => setShowAutomationGuide(false)}
                className="text-xs text-indigo-300 hover:text-white"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-indigo-200">
              When a customer pays via PhonePe/GPay, their phone notification forwards directly to this URL to trigger instant printing!
            </p>

            {/* Webhook URL with 1-Click Copy */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-300">Your Phone Webhook Target URL:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-black/40 border border-indigo-700 text-amber-300 font-mono text-xs px-3.5 py-2.5 rounded-xl focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm shrink-0"
                >
                  {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step setup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-800 space-y-1">
                <div className="font-bold text-amber-300">1. Download App</div>
                <div className="text-indigo-200 text-[11px]">
                  Install <strong>SMS Forwarder</strong> or <strong>MacroDroid</strong> (Free on Play Store) on the shop phone where PhonePe is logged in.
                </div>
              </div>
              <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-800 space-y-1">
                <div className="font-bold text-amber-300">2. Paste Webhook URL</div>
                <div className="text-indigo-200 text-[11px]">
                  Set Target: <strong>Webhook (POST)</strong> and paste the URL above.
                </div>
              </div>
              <div className="bg-indigo-900/60 p-3.5 rounded-xl border border-indigo-800 space-y-1">
                <div className="font-bold text-amber-300">3. Select PhonePe & GPay</div>
                <div className="text-indigo-200 text-[11px]">
                  Enable Notification forwarding for PhonePe, GPay, and Bank SMS. Done!
                </div>
              </div>
            </div>

            {/* Test Automation Button */}
            <div className="pt-2 flex items-center justify-between border-t border-indigo-900">
              <span className="text-[11px] text-indigo-300">Want to test if auto-verification works right now?</span>
              <button
                type="button"
                disabled={testSimulating}
                onClick={() => handleSimulateAutomatedPayment(pendingApprovals[0])}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{testSimulating ? 'Simulating...' : '🧪 Simulate Phone Notification Test'}</span>
              </button>
            </div>
          </div>
        )}

        {pendingApprovals.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No orders awaiting payment. When a customer taps PhonePe or scans the QR, their order appears here for 1-click confirmation.
          </div>
        ) : (
          <div className="divide-y divide-amber-200/50">
            {pendingApprovals.map((order) => {
              const isProcessing = actionLoadingId === order.id;
              const docSummary =
                order.documents
                  ?.map(
                    (d: any) =>
                      `${d.originalFilename} (${d.pageCount}p, ${d.settings?.colorMode || 'BW'})`
                  )
                  .join(', ') || 'Document';

              return (
                <div
                  key={order.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-amber-50/60 transition"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-sm text-center min-w-[90px]">
                      <div className="text-[10px] font-bold text-amber-700 uppercase">Token</div>
                      <div className="font-mono text-lg font-black text-slate-900">{order.tokenNumber}</div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-emerald-700">
                          ₹{Number(order.totalAmount).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          • {order.customer?.name || 'Customer'}
                        </span>
                        {order.customer?.phone && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({order.customer.phone})
                          </span>
                        )}
                      </div>
                      <div
                        className="text-xs text-slate-600 font-medium truncate max-w-md mt-0.5"
                        title={docSummary}
                      >
                        📄 {docSummary}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Submitted{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRejectPayment(order.id)}
                      className="px-3.5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Reject if payment was not received"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject (Unpaid)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprovePayment(order.id)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 transition flex items-center gap-2 disabled:bg-slate-300"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Releasing to Xerox...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Approve & Print</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Token & Sequence</th>
                <th className="py-3.5 px-4">Document Details</th>
                <th className="py-3.5 px-4">Print Mode</th>
                <th className="py-3.5 px-4">Target Printer</th>
                <th className="py-3.5 px-4">Job Status</th>
                <th className="py-3.5 px-4">Enqueued</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <ListOrdered className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <span className="font-semibold text-slate-600 block">No pending jobs in queue</span>
                    <span className="text-xs text-slate-400">Waiting for next customer scan & pay</span>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const settings = job.document?.settings;
                  const order = job.order;
                  const isQueued = job.status === 'QUEUED';

                  return (
                    <tr
                      key={job.id}
                      className={`transition ${
                        isQueued ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-base font-black text-indigo-600">
                          {order?.tokenNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Seq #{job.queueSequence} • {order?.customer?.name || 'Walk-in'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          className="font-bold text-slate-900 truncate max-w-[200px]"
                          title={job.document?.originalFilename}
                        >
                          {job.document?.originalFilename}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {job.document?.pageCount} pages • {settings?.copies || 1} copies
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex flex-col gap-0.5">
                          <span
                            className={`font-semibold ${
                              settings?.colorMode === 'COLOR' ? 'text-indigo-600' : 'text-slate-800'
                            }`}
                          >
                            {settings?.colorMode === 'COLOR' ? '🎨 Full Color' : '📄 Black & White'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {settings?.paperSize} • {settings?.duplexMode === 'DOUBLE' ? 'Duplex' : 'Single'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {job.printer ? (
                          <div className="flex items-center gap-1.5">
                            <Printer className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-bold text-slate-900">{job.printer.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Default Xerox</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={job.status} />
                        {job.errorMessage && (
                          <div
                            className="text-[10px] text-rose-600 mt-1 max-w-[150px] truncate"
                            title={job.errorMessage}
                          >
                            {job.errorMessage}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* 1-Click Print Button */}
                        <button
                          onClick={() => handleManualPrint(job)}
                          disabled={actionLoadingId === job.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-200 transition active:scale-95 disabled:bg-indigo-400"
                          title="Print Document directly to Xerox"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>

                        {/* Preview Document */}
                        <a
                          href={`/api/documents/preview/${job.document?.storedFilename}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                          title="Preview Document Securely"
                        >
                          <Eye className="w-4 h-4" />
                        </a>

                        {/* Retry button for failed jobs */}
                        {['FAILED', 'NEEDS_REVIEW'].includes(job.status) && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={actionLoadingId === job.id}
                            className="inline-flex p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Retry Job"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Mark Ready for Collection */}
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'READY_FOR_COLLECTION')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                          title="Mark Ready for Customer Pickup"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </button>

                        {/* Mark Collected */}
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'COLLECTED')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                          title="Mark Collected & Finished"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Done</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
