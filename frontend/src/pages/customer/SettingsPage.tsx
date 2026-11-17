import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Copy,
  Layers,
  Palette,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  BookOpen,
  Check,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { api } from '../../services/api';
import { UploadedFileItem, CalculatedOrderPrice } from '../../types';

interface SettingsPageProps {
  files: UploadedFileItem[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
  priceCalculation: CalculatedOrderPrice | null;
  setPriceCalculation: React.Dispatch<React.SetStateAction<CalculatedOrderPrice | null>>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  files,
  setFiles,
  priceCalculation,
  setPriceCalculation,
}) => {
  const navigate = useNavigate();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (files.length === 0) {
      navigate('/upload');
      return;
    }
    recalculatePrices();
  }, [files]);

  const recalculatePrices = async () => {
    if (files.length === 0) return;
    setCalculating(true);
    try {
      const itemsPayload = files.map((f) => ({
        originalFilename: f.originalFilename,
        pageCount: f.pageCount,
        setting: {
          documentId: f.tempId,
          colorMode: f.setting.colorMode,
          paperSize: f.setting.paperSize,
          duplexMode: f.setting.duplexMode,
          orientation: f.setting.orientation,
          copies: f.setting.copies,
          pageRangeType: f.setting.pageRangeType,
          customRange: f.setting.customRange,
          bindingService: f.setting.bindingService,
          laminationService: f.setting.laminationService,
        },
      }));

      const result = await api.calculatePrice(itemsPayload);
      setPriceCalculation(result);
    } catch (err) {
      console.error('Pricing calculation error:', err);
    } finally {
      setCalculating(false);
    }
  };

  const updateCurrentSetting = (key: string, value: any) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[activeFileIndex] = {
        ...updated[activeFileIndex],
        setting: {
          ...updated[activeFileIndex].setting,
          [key]: value,
        },
      };
      return updated;
    });
  };

  const currentFile = files[activeFileIndex] || files[0];
  const currentItemPrice = priceCalculation?.items?.[activeFileIndex];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={2} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Print Settings</h1>
            <p className="text-xs text-slate-500">Configure options for each document</p>
          </div>
          {priceCalculation && (
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Price</span>
              <div className="text-lg font-black text-indigo-600">₹{priceCalculation.totalAmount.toFixed(2)}</div>
            </div>
          )}
        </div>

        {/* Tab pills for documents if more than 1 */}
        {files.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {files.map((file, idx) => (
              <button
                key={file.tempId || idx}
                onClick={() => setActiveFileIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  activeFileIndex === idx
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Doc {idx + 1}: {file.originalFilename.substring(0, 14)}...
              </button>
            ))}
          </div>
        )}

        {/* Active Document Setting Card */}
        {currentFile && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-5">
            {/* Document Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{currentFile.originalFilename}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{currentFile.pageCount} Total Pages</div>
                </div>
              </div>

              {currentItemPrice && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900">₹{currentItemPrice.documentTotal.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400">
                    {currentItemPrice.sheetsCount} {currentItemPrice.sheetsCount === 1 ? 'Sheet' : 'Sheets'}
                  </div>
                </div>
              )}
            </div>

            {/* 1. Color vs B&W Mode */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Print Color Type</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateCurrentSetting('colorMode', 'BW')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                    currentFile.setting.colorMode === 'BW'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    B
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Black & White</div>
                    <div className="text-[11px] text-slate-500 font-medium">Standard xerox (₹2.00)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentSetting('colorMode', 'COLOR')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                    currentFile.setting.colorMode === 'COLOR'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 via-amber-400 to-indigo-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    C
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Full Color</div>
                    <div className="text-[11px] text-indigo-600 font-semibold">HD Laser Color (₹10.00)</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Paper Size & Duplex Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Paper Size</label>
                <select
                  value={currentFile.setting.paperSize}
                  onChange={(e) => updateCurrentSetting('paperSize', e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="A4">A4 (Standard)</option>
                  <option value="A3">A3 (Poster / Double)</option>
                  <option value="LEGAL">Legal (Long sheet)</option>
                  <option value="LETTER">Letter</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Sides Mode</label>
                <select
                  value={currentFile.setting.duplexMode}
                  onChange={(e) => updateCurrentSetting('duplexMode', e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="SINGLE">Single-Sided</option>
                  <option value="DOUBLE">Double-Sided (Save paper)</option>
                </select>
              </div>
            </div>

            {/* 3. Copies and Orientation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Copies</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => updateCurrentSetting('copies', Math.max(1, currentFile.setting.copies - 1))}
                    className="w-9 h-9 rounded-l-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={currentFile.setting.copies}
                    onChange={(e) => updateCurrentSetting('copies', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 text-center text-xs font-bold border-y border-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateCurrentSetting('copies', currentFile.setting.copies + 1)}
                    className="w-9 h-9 rounded-r-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Orientation</label>
                <select
                  value={currentFile.setting.orientation}
                  onChange={(e) => updateCurrentSetting('orientation', e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="PORTRAIT">Portrait (Vertical)</option>
                  <option value="LANDSCAPE">Landscape (Horizontal)</option>
                </select>
              </div>
            </div>

            {/* 4. Page Range Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Page Range</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => updateCurrentSetting('pageRangeType', 'ALL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    currentFile.setting.pageRangeType === 'ALL'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  All Pages ({currentFile.pageCount})
                </button>
                <button
                  type="button"
                  onClick={() => updateCurrentSetting('pageRangeType', 'CUSTOM')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    currentFile.setting.pageRangeType === 'CUSTOM'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Custom Range
                </button>
              </div>

              {currentFile.setting.pageRangeType === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder={`e.g. 1-3, 5 (up to ${currentFile.pageCount})`}
                  value={currentFile.setting.customRange || ''}
                  onChange={(e) => updateCurrentSetting('customRange', e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              )}
            </div>

            {/* 5. Additional Optional Services */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Finishing & Additional Services
              </label>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={currentFile.setting.bindingService === 'SPIRAL'}
                      onChange={(e) =>
                        updateCurrentSetting('bindingService', e.target.checked ? 'SPIRAL' : 'NONE')
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Spiral Binding</div>
                      <div className="text-[11px] text-slate-400">Coil + front & back plastic sheets</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">+₹40.00</span>
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={currentFile.setting.laminationService || false}
                      onChange={(e) => updateCurrentSetting('laminationService', e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Thermal Lamination</div>
                      <div className="text-[11px] text-slate-400">Protective glossy pouch</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">+₹20.00/sheet</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 bg-white hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/review')}
            className="flex-2 py-3 px-5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 transition"
          >
            <span>Review Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
