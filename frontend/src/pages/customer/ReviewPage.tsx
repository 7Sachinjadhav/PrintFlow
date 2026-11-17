import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { UploadedFileItem, CalculatedOrderPrice } from '../../types';

interface ReviewPageProps {
  files: UploadedFileItem[];
  priceCalculation: CalculatedOrderPrice | null;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  orderNotes: string;
  setOrderNotes: (val: string) => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  files,
  priceCalculation,
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  orderNotes,
  setOrderNotes,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (files.length === 0) {
      navigate('/upload');
    }
  }, [files.length, navigate]);

  // Compute safe breakdown even if API price calculation is still loading
  const safeItems = useMemo(() => {
    if (priceCalculation?.items && priceCalculation.items.length === files.length) {
      return priceCalculation.items;
    }
    return files.map((f) => {
      const isColor = f.setting.colorMode === 'COLOR';
      const ratePerPage = isColor ? 10.0 : 2.0;
      const copies = f.setting.copies || 1;
      const pages = f.pageCount || 1;
      const isDuplex = f.setting.duplexMode === 'DOUBLE';
      const sheetsCount = isDuplex ? Math.ceil(pages / 2) * copies : pages * copies;
      const bindingCost = f.setting.bindingService === 'SPIRAL' ? 40 : 0;
      const laminationCost = f.setting.laminationService ? 20 * sheetsCount : 0;
      const printSubtotal = pages * ratePerPage * copies;
      const documentTotal = printSubtotal + bindingCost + laminationCost;

      return {
        documentId: f.tempId,
        billablePages: pages * copies,
        sheetsCount,
        pageRate: ratePerPage,
        printSubtotal,
        bindingCost,
        laminationCost,
        documentTotal,
      };
    });
  }, [files, priceCalculation]);

  const totalSheets = safeItems.reduce((sum, item) => sum + (item.sheetsCount || 1), 0);
  const totalPages = safeItems.reduce((sum, item) => sum + (item.billablePages || 1), 0);
  const subtotal = priceCalculation?.subtotal ?? safeItems.reduce((sum, item) => sum + (item.documentTotal || 0), 0);
  const taxAmount = priceCalculation?.taxAmount ?? 0;
  const totalAmount = priceCalculation?.totalAmount ?? subtotal;

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={3} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Review Your Order</h1>
          <p className="text-xs text-slate-500">Verify print details before payment</p>
        </div>

        {/* Document Breakdown List */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Documents ({files.length})
          </div>

          <div className="divide-y divide-slate-100">
            {files.map((file, idx) => {
              const itemPrice = safeItems[idx];
              return (
                <div key={file.tempId || idx} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[240px]">
                      {file.originalFilename}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">
                      ₹{itemPrice?.documentTotal?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                      {file.setting.colorMode === 'COLOR' ? '🎨 Full Color' : '📄 Black & White'}
                    </span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                      {file.setting.paperSize}
                    </span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                      {file.setting.duplexMode === 'DOUBLE' ? 'Double-sided' : 'Single-sided'}
                    </span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                      {file.setting.copies} {file.setting.copies === 1 ? 'Copy' : 'Copies'}
                    </span>
                    {file.setting.bindingService === 'SPIRAL' && (
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                        + Spiral Binding
                      </span>
                    )}
                    {file.setting.laminationService && (
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                        + Lamination
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Contact Details */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Contact Information (Optional)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Your Name</label>
              <input
                type="text"
                placeholder="e.g. Rahul"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Mobile / WhatsApp</label>
              <input
                type="tel"
                placeholder="10-digit number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Special Instructions / Notes</label>
            <input
              type="text"
              placeholder="e.g. Staple top-left corner, punch holes..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Final Price Breakdown Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payment Summary
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Total Pages / Sheets:</span>
            <span className="font-semibold">{totalPages} pages ({totalSheets} physical sheets)</span>
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Subtotal:</span>
            <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
          </div>

          {taxAmount > 0 && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>GST / Taxes:</span>
              <span className="font-semibold">₹{taxAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
            <span className="font-bold text-slate-900">Total Payable:</span>
            <span className="text-xl font-black text-indigo-600">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 bg-white hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Edit Settings</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/payment')}
            className="flex-2 py-3.5 px-5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition"
          >
            <span>Proceed to Pay ₹{totalAmount.toFixed(2)}</span>
            <CreditCard className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
