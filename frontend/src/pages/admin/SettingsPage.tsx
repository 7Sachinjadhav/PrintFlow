import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Settings, Save, QrCode, Download, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

export const SettingsPage: React.FC = () => {
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const fetchShop = async () => {
    try {
      const data = await api.getShop();
      setShop(data);
    } catch (err) {
      console.error('Failed to load shop settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShop();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateShopSettings({
        name: shop.name,
        address: shop.address,
        phone: shop.phone,
        workingHours: shop.workingHours,
        isOpen: shop.isOpen,
        maxUploadSizeBytes: shop.maxUploadSizeBytes,
        retentionDays: shop.retentionDays || 7,
      });
      setSavedMsg('Shop configuration updated successfully!');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const storeUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shop & Hardware Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Shop counter QR code, business details, and document retention policies</p>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* QR Code Standee Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center space-y-4 md:col-span-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Counter QR Code</h2>
            <p className="text-xs text-slate-400 mt-0.5">Customers scan this to open your shop's mobile portal</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-block mx-auto shadow-inner">
            <QRCodeSVG value={storeUrl} size={180} level="H" includeMargin />
          </div>

          <div className="text-[11px] font-mono text-slate-500 break-all bg-slate-50 p-2 rounded-xl border border-slate-100">
            {storeUrl}
          </div>
        </div>

        {/* Shop Info Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm md:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Business Profile & Operational Rules</h2>

          {shop && (
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Shop Name</label>
                  <input
                    type="text"
                    value={shop.name || ''}
                    onChange={(e) => setShop({ ...shop, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={shop.phone || ''}
                    onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Physical Address</label>
                <input
                  type="text"
                  value={shop.address || ''}
                  onChange={(e) => setShop({ ...shop, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Working Hours</label>
                <input
                  type="text"
                  value={shop.workingHours || ''}
                  onChange={(e) => setShop({ ...shop, workingHours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Upload Limit (MB)</label>
                  <input
                    type="number"
                    value={Math.round((shop.maxUploadSizeBytes || 26214400) / (1024 * 1024))}
                    onChange={(e) =>
                      setShop({
                        ...shop,
                        maxUploadSizeBytes: (parseInt(e.target.value) || 25) * 1024 * 1024,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Doc Retention Period (Days)</label>
                  <input
                    type="number"
                    value={shop.retentionDays || 7}
                    onChange={(e) => setShop({ ...shop, retentionDays: parseInt(e.target.value) || 7 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
