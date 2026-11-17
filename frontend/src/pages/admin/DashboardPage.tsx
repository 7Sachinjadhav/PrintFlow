import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Coins,
  Clock,
  Printer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  ListOrdered,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !summary) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading Dashboard Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time status of orders, revenue, and Xerox machines</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSummary}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/admin/queue"
            className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-200 transition"
          >
            <ListOrdered className="w-4 h-4" />
            <span>Open Live Queue</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today's Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Orders</span>
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.todayOrders || 0}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Active flow</span>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Revenue</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">₹{(summary?.todayRevenue || 0).toFixed(2)}</div>
          <div className="text-[11px] text-slate-500 mt-1">UPI & Card verified</div>
        </div>

        {/* Printing / Pending Queue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active In Queue</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {(summary?.pendingOrders || 0) + (summary?.printingOrders || 0)}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">
            {summary?.printingOrders || 0} currently printing
          </div>
        </div>

        {/* Connected Printers */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Printers Online</span>
            <Printer className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summary?.printersOnline || 0} / {summary?.totalPrinters || 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Konica & Canon active</div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Customer Orders</h2>
            <p className="text-xs text-slate-500">Live order queue updates</p>
          </div>
          <Link
            to="/admin/orders"
            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Docs</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {summary?.recentOrders?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No orders placed today yet.
                  </td>
                </tr>
              ) : (
                summary?.recentOrders?.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {order.tokenNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{order.customer?.name || 'Walk-in'}</div>
                      <div className="text-[11px] text-slate-400">{order.customer?.phone || 'No phone'}</div>
                    </td>
                    <td className="py-3 px-4">{order.documents?.length || 1} file(s)</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{order.totalAmount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/track/${order.id}`}
                        target="_blank"
                        className="text-indigo-600 font-semibold hover:underline"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
