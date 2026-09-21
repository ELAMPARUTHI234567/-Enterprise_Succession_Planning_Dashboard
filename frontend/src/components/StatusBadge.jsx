import React from 'react';

export const StatusBadge = ({ status, type = 'readiness' }) => {
  if (type === 'readiness') {
    switch (status) {
      case 'High':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            High Readiness
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            Medium Readiness
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
            Low Readiness
          </span>
        );
    }
  }

  if (type === 'gap') {
    switch (status) {
      case 'Strength':
      case 'No Gap':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Strength
          </span>
        );
      case 'Low Gap':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Low Gap (0-10)
          </span>
        );
      case 'Medium Gap':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Medium Gap (11-20)
          </span>
        );
      case 'High Gap':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-300 animate-pulse">
            High Gap (&gt;20)
          </span>
        );
    }
  }

  return <span className="text-xs text-slate-500">{status}</span>;
};

export default StatusBadge;
