import React from 'react';
import { OrderStatus } from '../types';

interface StatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getBadgeStyle = (st: string) => {
    switch (st) {
      case 'PAYMENT_PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PAID':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'QUEUED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'ASSIGNED':
      case 'PRINTING':
        return 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse';
      case 'PRINTED':
      case 'SUBMITTED_TO_PRINTER':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'READY_FOR_COLLECTION':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold';
      case 'COLLECTED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'PAYMENT_FAILED':
      case 'PRINT_FAILED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'NEEDS_REVIEW':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'ONLINE':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'OFFLINE':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'BUSY':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatText = (st: string) => {
    return st.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {formatText(status)}
    </span>
  );
};
