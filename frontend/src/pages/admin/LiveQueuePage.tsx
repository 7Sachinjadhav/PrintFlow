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
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { useSocket } from '../../hooks/useSocket';

export const LiveQueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
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
  const [lastPrintedMessage, setLastPrintedMessage] = useState<string | null>(null);

  // Keep track of job IDs that have already been auto-printed in this browser session
  const autoPrintedJobIdsRef = useRef<Set<string>>(new Set());

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
      const data = await api.getAdminQueue();
      setJobs(data);

      // Auto-print check: if Auto-Print is enabled, find any unprinted QUEUED jobs
      if (autoPrintEnabled && Array.isArray(data)) {
        const queuedJobs = data.filter((j) => j.status === 'QUEUED' && !autoPrintedJobIdsRef.current.has(j.id));

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
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [autoPrintEnabled, soundEnabled]);

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_queue_job', () => {
      playAlertChime();
      fetchQueue();
    });
    socket.on('queue_job_claimed', fetchQueue);
    socket.on('queue_updated', fetchQueue);
    socket.on('order_status_updated', fetchQueue);

    return () => {
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
