import React, { useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, Calendar, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

export const ReportsPage: React.FC = () => {
  const [downloading, setDownloading] = useState(false);

  const handleExportCsv = async () => {
    setDownloading(true);
    try {
      const csvData = await api.exportOrdersCsv();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `printflow-orders-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Reports & Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Generate daily, weekly, and monthly performance reports and CSV exports</p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={downloading}
          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Preparing CSV...' : 'Export Orders to CSV'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Order Volume Report</h2>
          <p className="text-xs text-slate-500">Breakdown of orders processed daily across Konica and Canon machines.</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Revenue & Margin Analytics</h2>
          <p className="text-xs text-slate-500">Gross revenue, add-on service contributions (spiral binding & lamination).</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Paper & Toner Utilization</h2>
          <p className="text-xs text-slate-500">A4 vs A3 vs Legal sheets, single-sided vs double-sided duplex ratio.</p>
        </div>
      </div>
    </div>
  );
};
