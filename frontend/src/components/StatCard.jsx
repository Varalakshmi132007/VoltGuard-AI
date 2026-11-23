import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, color = 'blue', badge }) {
  const colorMap = {
    blue: 'text-electric-400 border-electric-500/20 bg-electric-500/10',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    red: 'text-red-400 border-red-500/20 bg-red-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
  };

  return (
    <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{value}</h3>
          {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${colorMap[color] || colorMap.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3 pt-2.5 border-t border-navy-800 text-[11px] text-slate-400 flex items-center justify-between">
          {badge}
        </div>
      )}
    </div>
  );
}
