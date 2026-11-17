import React, { useEffect, useState } from 'react';
import { Users, Search, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export const CustomersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    api.getAllOrders({ limit: 50 }).then((res) => setOrders(res.orders || []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
        <p className="text-xs text-slate-500 mt-0.5">Customers who have ordered prints through QR codes</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Last Token</th>
                <th className="py-3 px-4">Total Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No customers found yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{order.customer?.name || 'Walk-in Guest'}</td>
                    <td className="py-3 px-4">{order.customer?.phone || '—'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{order.tokenNumber}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">1 Order</td>
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
