import React from 'react';
import { Link } from 'react-router-dom';
import { Printer, Search, ShieldCheck } from 'lucide-react';
import { ShopInfo } from '../types';

interface CustomerHeaderProps {
  shop?: ShopInfo | null;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({ shop }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5">
              <span>{shop?.name || 'PrintFlow Xerox'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Online" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Smart QR Printing</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/track"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Track Order</span>
          </Link>
          <Link
            to="/admin/login"
            className="text-xs text-slate-400 hover:text-slate-600 p-1.5 rounded-md"
            title="Shop Admin Login"
          >
            <ShieldCheck className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};
