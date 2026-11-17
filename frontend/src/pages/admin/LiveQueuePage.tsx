import React, { useEffect, useState } from 'react';
import {
  ListOrdered,
  RefreshCw,
  Printer,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Eye,
  XCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { useSocket } from '../../hooks/useSocket';

export const LiveQueuePage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const socket = useSocket();

  const fetchQueue = async () => {
    try {
      const data = await api.getAdminQueue();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_queue_job', fetchQueue);
    socket.on('queue_job_claimed', fetchQueue);
    socket.on('queue_updated', fetchQueue);
    socket.on('order_status_updated', fetchQueue);

    return () => {
      socket.off('new_queue_job', fetchQueue);
      socket.off('queue_job_claimed', fetchQueue);
      socket.off('queue_updated', fetchQueue);
      socket.off('order_status_updated', fetchQueue);
    };
  }, [socket]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Live Printing Queue</h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {jobs.length} Active Jobs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Real-time FIFO queue dispatching to Windows print agents</p>
        </div>

        <button
          onClick={fetchQueue}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
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
                <th className="py-3.5 px-4">Assigned Printer</th>
                <th className="py-3.5 px-4">Job Status</th>
                <th className="py-3.5 px-4">Enqueued</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ListOrdered className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>No active print jobs in queue. Everything is completed!</span>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const settings = job.document?.settings;
                  const order = job.order;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-sm font-black text-indigo-600">
                          {order?.tokenNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Seq #{job.queueSequence} • {order?.customer?.name || 'Walk-in'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 truncate max-w-[200px]" title={job.document?.originalFilename}>
                          {job.document?.originalFilename}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {job.document?.pageCount} pages • {settings?.copies || 1} copies
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex flex-col gap-0.5">
                          <span className={`font-semibold ${settings?.colorMode === 'COLOR' ? 'text-indigo-600' : 'text-slate-800'}`}>
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
                          <span className="text-slate-400 italic">Auto-routing...</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={job.status} />
                        {job.errorMessage && (
                          <div className="text-[10px] text-rose-600 mt-1 max-w-[150px] truncate" title={job.errorMessage}>
                            {job.errorMessage}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
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

                        {/* Retry button for failed/review jobs */}
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
                          <span>Collected</span>
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
