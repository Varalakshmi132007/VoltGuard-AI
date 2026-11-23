import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import ConsumerDetailModal from '../components/ConsumerDetailModal';
import {
  ShieldAlert,
  Flame,
  CheckCircle,
  AlertTriangle,
  Info,
  Eye,
  Sliders,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function PossibleTheftDetection({ onNavigate }) {
  const [prioritiesData, setPrioritiesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConsumerId, setSelectedConsumerId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    api.getInspectionPriorities()
      .then((data) => {
        setPrioritiesData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <div className="w-8 h-8 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Calculating multi-factor risk prioritization scores...</p>
      </div>
    );
  }

  const consumers = prioritiesData?.prioritized_consumers || [];

  return (
    <div className="space-y-6">
      {/* Title & Research Disclaimer */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Inspection Priority Ranking & Unauthorized Usage Screening
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Targeted inspection prioritization (0-100 score) combining consumer anomaly intensity, load deviations, recurrence, and transformer discrepancy.
          </p>
        </div>

        {/* Disclaimer Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-300 max-w-md self-start md:self-auto">
          <p className="font-semibold flex items-center gap-1.5 text-amber-400">
            <Info className="w-4 h-4 shrink-0" />
            Important Engineering & Legal Disclaimer:
          </p>
          <p className="text-[11px] text-amber-200/90 mt-0.5 leading-tight">
            Risk scores represent investigation priorities, not proof of theft. Never disconnect or accuse consumers without certified field inspection.
          </p>
        </div>
      </div>

      {/* Priority Summary Tiers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 glow-card">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Critical Risk (81-100)</span>
          <p className="text-2xl font-extrabold text-white mt-1">{prioritiesData?.critical_count}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Immediate physical dispatch</p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 glow-card">
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">High Risk (61-80)</span>
          <p className="text-2xl font-extrabold text-white mt-1">{prioritiesData?.high_count}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Scheduled audit within 48h</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 glow-card">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Medium Risk (31-60)</span>
          <p className="text-2xl font-extrabold text-white mt-1">{prioritiesData?.medium_count}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Automated telemetry tracking</p>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 glow-card">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Low Risk (0-30)</span>
          <p className="text-2xl font-extrabold text-white mt-1">{prioritiesData?.low_count}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Normal baseline variation</p>
        </div>
      </div>

      {/* Transparent Formula Explain Card */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-4 text-xs">
        <h4 className="font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-electric-400" />
          Transparent Weighted Scoring Methodology (No Hidden Black-Box):
        </h4>
        <p className="text-slate-400 leading-relaxed font-mono text-[11px]">
          Score (0-100) = (Anomaly Intensity × 35%) + (Deviation Magnitude × 25%) + (Recurrence Frequency × 20%) + (Transformer Discrepancy × 20%)
        </p>
      </div>

      {/* Prioritization Table */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Priority Rank</th>
                <th className="py-3 px-4">Consumer</th>
                <th className="py-3 px-4">Transformer & Feeder</th>
                <th className="py-3 px-4">Primary Suspicion</th>
                <th className="py-3 px-4">Deviation</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Risk Tier</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300">
              {consumers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No active suspicious consumers flagged.
                  </td>
                </tr>
              ) : (
                consumers.map((c, idx) => (
                  <React.Fragment key={c.consumer_id}>
                    <tr className="hover:bg-navy-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{c.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">{c.consumer_id} • {c.category} ({c.connected_load_capacity} kW)</p>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <p className="font-mono text-slate-200 font-semibold">{c.transformer_id} <span className="text-red-400">({c.transformer_discrepancy_pct}% gap)</span></p>
                        <p className="text-slate-400">{c.feeder_id}</p>
                      </td>
                      <td className="py-3 px-4 text-[11px] font-medium text-slate-200">
                        {c.primary_suspicion}
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold ${
                        c.max_deviation_pct > 60 ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {c.max_deviation_pct}%
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-base text-white">
                        {c.risk_score}
                      </td>
                      <td className="py-3 px-4">
                        <RiskBadge level={c.risk_level} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setExpandedRow(expandedRow === c.consumer_id ? null : c.consumer_id)}
                            className="text-[11px] px-2 py-1 bg-navy-950 border border-navy-800 hover:border-slate-500 rounded text-slate-300 transition"
                          >
                            {expandedRow === c.consumer_id ? 'Hide Weights' : 'Why Score?'}
                          </button>
                          <button
                            onClick={() => setSelectedConsumerId(c.consumer_id)}
                            className="p-1.5 text-slate-400 hover:text-electric-400 rounded hover:bg-navy-800 transition"
                            title="View Full Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Score Breakdown Row */}
                    {expandedRow === c.consumer_id && (
                      <tr className="bg-navy-950/90 text-xs">
                        <td colSpan="8" className="p-4 border-b border-navy-800">
                          <div className="bg-navy-900 border border-navy-800 rounded-xl p-4 space-y-3">
                            <h5 className="font-bold text-electric-400 uppercase tracking-wider text-[11px]">
                              Mathematical Score Attribution for {c.consumer_id}:
                            </h5>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                                <span className="text-slate-400 text-[10px] block">Anomaly Intensity (35% Max)</span>
                                <span className="font-mono font-bold text-white text-sm">
                                  {c.score_breakdown.anomaly_intensity_points} pts
                                </span>
                                <span className="text-[10px] text-slate-500 block">Peak Anomaly: {c.peak_anomaly_score}</span>
                              </div>
                              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                                <span className="text-slate-400 text-[10px] block">Deviation Magnitude (25% Max)</span>
                                <span className="font-mono font-bold text-white text-sm">
                                  {c.score_breakdown.deviation_magnitude_points} pts
                                </span>
                                <span className="text-[10px] text-slate-500 block">Max Dev: {c.max_deviation_pct}%</span>
                              </div>
                              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                                <span className="text-slate-400 text-[10px] block">Recurrence (20% Max)</span>
                                <span className="font-mono font-bold text-white text-sm">
                                  {c.score_breakdown.recurrence_frequency_points} pts
                                </span>
                                <span className="text-[10px] text-slate-500 block">{c.anomaly_occurrences} flags in 7 days</span>
                              </div>
                              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                                <span className="text-slate-400 text-[10px] block">Transformer Context (20% Max)</span>
                                <span className="font-mono font-bold text-white text-sm">
                                  {c.score_breakdown.transformer_context_points} pts
                                </span>
                                <span className="text-[10px] text-slate-500 block">TR Discrepancy: {c.transformer_discrepancy_pct}%</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Recommendation: <span className="text-slate-200">{c.risk_level === 'Critical' ? 'Deploy field inspection team with calibrated reference meter.' : 'Review load survey logs and verify meter seal integrity.'}</span>
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedConsumerId && (
        <ConsumerDetailModal
          consumerId={selectedConsumerId}
          onClose={() => setSelectedConsumerId(null)}
        />
      )}
    </div>
  );
}
