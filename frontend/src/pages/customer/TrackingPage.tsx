import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  PackageCheck,
  FileText,
  Sparkles,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { OrderStatus } from '../../types';

export const TrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const socket = useSocket();

  const loadOrder = async (idOrToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.trackOrder(idOrToken);
      setOrder(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'No order found with this Token or ID');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    } else {
      setLoading(false);
    }
  }, [orderId]);

  // Socket.IO real-time event listener
  useEffect(() => {
    if (!socket || !order?.id) return;

    socket.emit('join_order_room', order.id);

    const handleStatusUpdate = (payload: { orderId: string; status: OrderStatus }) => {
      if (payload.orderId === order.id) {
        setOrder((prev: any) => (prev ? { ...prev, status: payload.status } : prev));
      }
    };

    socket.on('order_status_updated', handleStatusUpdate);

    return () => {
      socket.off('order_status_updated', handleStatusUpdate);
    };
  }, [socket, order?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      loadOrder(searchInput.trim().toUpperCase());
    }
  };

  // Stepper status definitions
  const steps: { key: OrderStatus; label: string; desc: string }[] = [
    { key: 'PAID', label: 'Payment Verified', desc: 'Order confirmed and saved' },
    { key: 'QUEUED', label: 'In Printing Queue', desc: 'Waiting for assigned printer' },
    { key: 'PRINTING', label: 'Printing Document', desc: 'High-speed printer active' },
    { key: 'READY_FOR_COLLECTION', label: 'Ready for Collection', desc: 'Pick up at shop counter' },
    { key: 'COLLECTED', label: 'Collected', desc: 'Prints handed over to customer' },
  ];

  const getStepStatus = (stepKey: string, currentStatus: string) => {
    const orderIndex = ['PAID', 'QUEUED', 'ASSIGNED', 'PRINTING', 'PRINTED', 'READY_FOR_COLLECTION', 'COLLECTED'];
    const curIdx = orderIndex.indexOf(currentStatus);
    const thisIdx = orderIndex.indexOf(stepKey);

    if (currentStatus === stepKey || (stepKey === 'PRINTING' && currentStatus === 'ASSIGNED')) {
      return 'CURRENT';
    }
    if (curIdx > thisIdx) {
      return 'COMPLETED';
    }
    return 'UPCOMING';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Search header if searching or switching orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by Token (e.g. PF-001) or Order ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase placeholder:normal-case placeholder:font-normal"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition"
            >
              Search
            </button>
          </form>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-slate-500">Checking order status...</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!loading && order && (
          <div className="space-y-4">
            {/* Live Status Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Live Token Number
                  </span>
                  <div className="text-4xl font-black text-indigo-600 tracking-wider font-mono mt-0.5">
                    {order.tokenNumber}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={order.status} className="text-xs px-3 py-1 font-bold" />
                  <button
                    onClick={() => loadOrder(order.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 font-semibold mt-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Ready for collection banner */}
              {order.status === 'READY_FOR_COLLECTION' && (
                <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 animate-bounce">
                  <PackageCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Your Prints Are Ready!</div>
                    <div className="text-[11px] text-emerald-700">Please show token {order.tokenNumber} at the counter.</div>
                  </div>
                </div>
              )}

              {/* Stepper Progress */}
              <div className="mt-6 space-y-4">
                {steps.map((st, idx) => {
                  const state = getStepStatus(st.key, order.status);

                  return (
                    <div key={st.key} className="flex items-start gap-3 relative">
                      {idx < steps.length - 1 && (
                        <div
                          className={`absolute left-3.5 top-7 w-0.5 h-7 ${
                            state === 'COMPLETED' ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                        />
                      )}

                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 transition-colors ${
                          state === 'COMPLETED'
                            ? 'bg-indigo-600 text-white'
                            : state === 'CURRENT'
                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 animate-pulse'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {state === 'COMPLETED' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      <div className="flex-1">
                        <div
                          className={`text-xs font-bold ${
                            state === 'CURRENT'
                              ? 'text-indigo-600 font-extrabold'
                              : state === 'COMPLETED'
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {st.label}
                        </div>
                        <div className="text-[11px] text-slate-400">{st.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document summary inside this order */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Order Documents ({order.documents?.length || 0})
              </div>

              <div className="space-y-2">
                {order.documents?.map((doc: any, idx: number) => (
                  <div key={doc.id || idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="truncate font-semibold text-slate-800 max-w-[200px]">
                        {doc.originalFilename}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {doc.settings?.colorMode === 'COLOR' ? 'Color' : 'B&W'} • {doc.settings?.copies || 1}x
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/" className="text-xs font-bold text-indigo-600 hover:underline">
                ← Back to Shop Home
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
