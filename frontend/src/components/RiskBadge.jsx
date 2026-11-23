import React from 'react';

export default function RiskBadge({ level, score }) {
  const getColors = () => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'low':
      case 'normal':
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getColors()}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${level?.toLowerCase() === 'critical' ? 'bg-red-400 animate-pulse' : level?.toLowerCase() === 'high' ? 'bg-orange-400' : level?.toLowerCase() === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      {level || 'Normal'}
      {score !== undefined && score !== null && <span className="opacity-80">({score})</span>}
    </span>
  );
}
