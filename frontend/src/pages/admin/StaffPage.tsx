import React from 'react';
import { UserCog, Plus, ShieldCheck } from 'lucide-react';

export const StaffPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Operator Roles</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage operator PINs, shop counter staff, and access permissions</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Active Shop Admin</div>
              <div className="text-xs text-slate-400">admin@printflow.com • Full Permissions</div>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            SUPER_ADMIN
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-600">
          <strong>Staff Mode Note:</strong> Additional cashiers and Xerox machine operators can be assigned 4-digit PINs for quick tablet sign-in at the counter.
        </div>
      </div>
    </div>
  );
};
