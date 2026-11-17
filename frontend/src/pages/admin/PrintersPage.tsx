import React, { useEffect, useState } from 'react';
import {
  Printer as PrinterIcon,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Settings2,
  RefreshCw,
  Power,
  Sliders,
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { Printer } from '../../types';

export const PrintersPage: React.FC = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchPrinters = async () => {
    try {
      const data = await api.getPrinters();
      setPrinters(data);
    } catch (err) {
      console.error('Failed to load printers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleToggleEnable = async (printer: Printer) => {
    try {
      await api.updatePrinter(printer.id, { isEnabled: !printer.isEnabled });
      fetchPrinters();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleTestPrint = async (printer: Printer) => {
    setTestResult(null);
    try {
      const res = await api.testPrint(printer.id);
      setTestResult(res.message || 'Test print request dispatched to print agent!');
    } catch (err: any) {
      alert(`Test print error: ${err.message}`);
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrinter) return;

    try {
      await api.updatePrinter(editingPrinter.id, {
        name: editingPrinter.name,
        windowsQueueName: editingPrinter.windowsQueueName,
        assignedCapability: editingPrinter.assignedCapability,
        supportedPaperSizes: editingPrinter.supportedPaperSizes,
        routingPriority: editingPrinter.routingPriority,
      });
      setEditingPrinter(null);
      fetchPrinters();
    } catch (err: any) {
      alert(`Error saving printer: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Printer Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure network photocopiers (Konica 251, Canon 240) and Windows driver queue mappings
          </p>
        </div>

        <button
          onClick={fetchPrinters}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {testResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* Printer Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className={`bg-white rounded-3xl p-6 border shadow-sm transition space-y-4 ${
              printer.isEnabled ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    printer.assignedCapability === 'COLOR'
                      ? 'bg-gradient-to-tr from-pink-500 to-indigo-600 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  <PrinterIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">{printer.name}</h2>
                    {printer.isDefault && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">IP: {printer.ipAddress}</div>
                </div>
              </div>

              <StatusBadge status={printer.status} />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Windows Queue:</span>
                <span className="font-mono font-bold text-slate-800">
                  {printer.windowsQueueName || 'Not Assigned'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Color Assignment:</span>
                <span className="font-bold text-indigo-600">
                  {printer.assignedCapability === 'BOTH'
                    ? 'Color & Black/White'
                    : printer.assignedCapability === 'COLOR'
                    ? 'Color Only'
                    : 'B&W Only'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Supported Papers:</span>
                <span className="font-medium text-slate-700">{printer.supportedPaperSizes}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Routing Priority:</span>
                <span className="font-medium text-slate-700">Level {printer.routingPriority}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPrinter(printer)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Configure</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestPrint(printer)}
                className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                title="Send test page"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Test Print</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleEnable(printer)}
                className={`p-2 rounded-xl border transition ${
                  printer.isEnabled
                    ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                }`}
                title={printer.isEnabled ? 'Disable Printer' : 'Enable Printer'}
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Printer Modal */}
      {editingPrinter && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Configure {editingPrinter.name}</h3>
              <button onClick={() => setEditingPrinter(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingPrinter.name}
                  onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Windows Driver Queue Name</label>
                <input
                  type="text"
                  placeholder="e.g. EPSON L3250 Series or Microsoft Print to PDF"
                  value={editingPrinter.windowsQueueName || ''}
                  onChange={(e) => setEditingPrinter({ ...editingPrinter, windowsQueueName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must match the exact queue name reported by Windows Print Spooler.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Color Assignment</label>
                <select
                  value={editingPrinter.assignedCapability}
                  onChange={(e) =>
                    setEditingPrinter({ ...editingPrinter, assignedCapability: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="BOTH">Both (Color and Black & White)</option>
                  <option value="COLOR">Color Only</option>
                  <option value="BW">Black & White Only</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supported Paper Sizes</label>
                <input
                  type="text"
                  value={editingPrinter.supportedPaperSizes}
                  onChange={(e) => setEditingPrinter({ ...editingPrinter, supportedPaperSizes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="A4,A3,LEGAL"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Routing Priority (Higher = Preferred)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editingPrinter.routingPriority}
                  onChange={(e) =>
                    setEditingPrinter({ ...editingPrinter, routingPriority: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPrinter(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
