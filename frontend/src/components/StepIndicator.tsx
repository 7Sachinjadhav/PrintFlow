import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number; // 1: Upload, 2: Settings, 3: Review, 4: Payment
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Settings' },
    { num: 3, label: 'Review' },
    { num: 4, label: 'Pay' },
  ];

  return (
    <div className="w-full py-3 px-4 bg-white border-b border-slate-100">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {steps.map((s, idx) => {
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-[11px] mt-1 font-medium ${
                    isCurrent ? 'text-indigo-600 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-4 transition-colors ${
                    currentStep > s.num ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
