import React, { useEffect, useState } from 'react';
import { Coins, Save, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

export const PricingPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const fetchPricing = async () => {
    try {
      const data = await api.getAdminPricing();
      setRules(data.rules || []);
      setServices(data.services || []);
    } catch (err) {
      console.error('Failed to load pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleRuleChange = (id: string, newPrice: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, unitPrice: newPrice } : r))
    );
  };

  const handleServiceChange = (id: string, newPrice: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, basePrice: newPrice } : s))
    );
  };

  const handleSaveRule = async (rule: any) => {
    try {
      await api.updatePricingRule(rule.id, {
        unitPrice: rule.unitPrice,
        isActive: rule.isActive,
      });
      setSavedMsg(`Saved rate for ${rule.itemKey}`);
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleSaveService = async (svc: any) => {
    try {
      await api.updateService(svc.id, {
        basePrice: svc.basePrice,
        isEnabled: svc.isEnabled,
      });
      setSavedMsg(`Saved service for ${svc.name}`);
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pricing Configuration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure rates per page, color charges, duplex discounts, and additional Xerox services
          </p>
        </div>

        <button
          onClick={fetchPricing}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Rates</span>
        </button>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Print Rates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 font-bold text-sm text-slate-900">
          <Coins className="w-4 h-4 text-indigo-600" />
          <span>Per-Page Print Rates & Paper Sizes</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
              <div>
                <div className="font-bold text-slate-900 text-sm">{rule.itemKey.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{rule.description || rule.category}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={rule.unitPrice}
                    onChange={(e) => handleRuleChange(rule.id, parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs font-black text-slate-900 bg-transparent focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveRule(rule)}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Xerox Services */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 font-bold text-sm text-slate-900">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Add-on Finishing & Bindery Services</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {services.map((svc) => (
            <div key={svc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
              <div>
                <div className="font-bold text-slate-900 text-sm">{svc.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Unit: {svc.unitType.replace(/_/g, ' ')}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={svc.basePrice}
                    onChange={(e) => handleServiceChange(svc.id, parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs font-black text-slate-900 bg-transparent focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveService(svc)}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
