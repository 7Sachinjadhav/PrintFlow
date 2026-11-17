import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  Search,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  FileText,
  Sparkles,
  Printer,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';
import { CustomerHeader } from '../../components/CustomerHeader';
import { ShopInfo } from '../../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [searchToken, setSearchToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [shopData, pricingData] = await Promise.all([
          api.getShop(),
          api.getPricing(),
        ]);
        setShop(shopData);
        setPricing(pricingData);
      } catch (err) {
        console.error('Failed to load shop details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchToken.trim()) {
      navigate(`/track/${encodeURIComponent(searchToken.trim().toUpperCase())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader shop={shop} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl shadow-indigo-900/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Shop Open Now
            </span>
            <span className="text-xs text-indigo-200">No app install required</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-white">
            Instant Xerox & Prints <br />
            <span className="text-indigo-200 font-medium">Direct From Your Phone</span>
          </h1>

          <p className="mt-2 text-sm text-indigo-100/90 leading-relaxed">
            Upload your PDFs or photos, choose color or B&W, pay securely with UPI, and get your prints ready in minutes.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => navigate('/upload')}
              className="w-full py-3.5 px-5 bg-white text-indigo-900 font-bold text-base rounded-2xl shadow-lg hover:bg-indigo-50 active:scale-[0.99] transition flex items-center justify-center gap-2.5"
            >
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              <span>Upload Documents to Print</span>
              <ChevronRight className="w-4 h-4 text-indigo-400 ml-auto" />
            </button>
          </div>
        </div>

        {/* Quick Order Tracker Input */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-indigo-600" />
            Already Placed an Order?
          </div>
          <form onSubmit={handleTrackSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              placeholder="Enter Token (e.g. PF-001)"
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 uppercase font-semibold text-slate-800 placeholder:normal-case placeholder:font-normal"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition"
            >
              Track
            </button>
          </form>
        </div>

        {/* Pricing Transparency Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Standard Pricing Rates
            </h2>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Live Rates
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-semibold text-slate-500">Black & White (A4)</div>
              <div className="text-lg font-extrabold text-slate-900 mt-0.5">₹2.00 <span className="text-xs font-normal text-slate-500">/ page</span></div>
              <div className="text-[11px] text-slate-400 mt-1">Double-sided discount available</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-semibold text-slate-500">Full Color (A4)</div>
              <div className="text-lg font-extrabold text-indigo-600 mt-0.5">₹10.00 <span className="text-xs font-normal text-slate-500">/ page</span></div>
              <div className="text-[11px] text-slate-400 mt-1">High-definition inkjet/laser</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-semibold text-slate-500">A3 Poster / Large</div>
              <div className="text-lg font-extrabold text-slate-900 mt-0.5">₹5 – ₹20 <span className="text-xs font-normal text-slate-500">/ page</span></div>
              <div className="text-[11px] text-slate-400 mt-1">B&W or Full Color</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-semibold text-slate-500">Spiral Binding</div>
              <div className="text-lg font-extrabold text-slate-900 mt-0.5">₹40.00 <span className="text-xs font-normal text-slate-500">/ book</span></div>
              <div className="text-[11px] text-slate-400 mt-1">Coil binding + clear sheets</div>
            </div>
          </div>
        </div>

        {/* Shop Hours & Location */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Shop Information & Hours
          </h2>

          <div className="text-xs text-slate-600 space-y-2">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{shop?.address || 'Shop #4, University Metro Plaza, Main Road'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{shop?.workingHours || '8:00 AM – 10:00 PM (Monday – Sunday)'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <a href={`tel:${shop?.phone || '+919876543210'}`} className="text-indigo-600 font-semibold hover:underline">
                {shop?.phone || '+91 98765 43210'}
              </a>
            </div>
          </div>
        </div>

        {/* Privacy & Safety Note */}
        <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-950">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p>
            <strong>Privacy Guarantee:</strong> Your uploaded documents are processed securely and automatically deleted after collection according to the shop retention policy.
          </p>
        </div>
      </main>
    </div>
  );
};
