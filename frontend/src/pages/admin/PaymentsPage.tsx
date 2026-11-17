import React, { useEffect, useState } from 'react';
import { CreditCard, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';

export const PaymentsPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      const data = await api.getAllOrders({ limit: 100 });
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Transactions</h1>
          <p className="text-xs text-slate-500 mt-0.5">Payment gateway logs, UPI verifications, and transaction receipts</p>
        </div>

        <button
          onClick={fetchPayments}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Transaction / Order ID</th>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const payment = order.payments?.[0];
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {payment?.razorpayPaymentId || order.id.substring(0, 12)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {order.tokenNumber}
                      </td>
                      <td className="py-3 px-4">{order.customer?.name || 'Walk-in'}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">
                          {payment?.paymentMethod || 'Razorpay UPI'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        ₹{order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={payment?.status || (order.status !== 'PAYMENT_PENDING' ? 'PAID' : 'PENDING')} />
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
