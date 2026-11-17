import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Printer,
  ArrowRight,
  Share2,
  Layers,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { api } from '../../services/api';

export const TokenSuccessPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    async function fetchOrder() {
      try {
        const data = await api.getOrder(orderId!);
        setOrder(data);
      } catch (err) {
        console.error('Failed to load order:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Generating Token...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <CustomerHeader />
        <main className="flex-1 max-w-md mx-auto p-4 text-center mt-12">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Order Not Found</h2>
          <Link to="/" className="text-xs text-indigo-600 font-bold hover:underline mt-4 inline-block">
            Return to Homepage
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 space-y-5 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Payment Verified • Job Enqueued
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 mt-2">Your Order is Placed!</h1>
          <p className="text-xs text-slate-500">Show this token at the counter when collecting your prints.</p>
        </div>

        {/* Big Token Display Card */}
        <div className="bg-white rounded-3xl p-6 border-2 border-indigo-100 shadow-xl shadow-indigo-100/50 relative overflow-hidden">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Print Token Number</div>
          <div className="text-5xl font-black text-indigo-600 tracking-wider my-3 font-mono">
            {order.tokenNumber}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 text-left">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-slate-400">Queue Position</span>
              <div className="text-base font-bold text-slate-800 mt-0.5">
                #{order.queuePosition || 1} in line
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-slate-400">Est. Waiting Time</span>
              <div className="text-base font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>~{(order.queuePosition || 1) * 2} mins</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Details Mini Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Documents:</span>
            <span className="font-bold text-slate-900">{order.documents?.length || 1} file(s)</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Amount Paid:</span>
            <span className="font-bold text-slate-900">₹{order.totalAmount?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Payment Status:</span>
            <span className="font-bold text-emerald-600">PAID (Verified)</span>
          </div>
        </div>

        {/* Action Button: Live Tracker */}
        <div className="pt-2 space-y-2.5">
          <button
            onClick={() => navigate(`/track/${order.id}`)}
            className="w-full py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Track Live Printing Status</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            to="/"
            className="inline-block text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
          >
            Place Another Print Order
          </Link>
        </div>
      </main>
    </div>
  );
};
