import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import {
  Cpu,
  AlertTriangle,
  Users,
  TrendingDown,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function TransformerMonitoring({ onNavigate }) {
  const [transformers, setTransformers] = useState([]);
  const [selectedTrId, setSelectedTrId] = useState('TR-102');
  const [trDetail, setTrDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTransformers()
      .then((data) => {
        setTransformers(data);
        if (data.length > 0 && !selectedTrId) {
          setSelectedTrId(data[0].transformer_id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedTrId) return;
    setLoading(true);
    api.getTransformerDetail(selectedTrId)
      .then((data) => {
        setTrDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedTrId]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Cpu className="w-5 h-5 text-electric-400" />
          Transformer Monitoring & Suspicious Cluster Localization
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Downstream mass energy balance and transformer-wise suspicious consumer concentration.
        </p>
      </div>

      {/* Transformer Cards Grid (Highlighting T-102) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {transformers.map((tr) => {
          const isCritical = tr.priority_level === 'Critical' || tr.discrepancy_pct > 12;
          const isSelected = selectedTrId === tr.transformer_id;

          return (
            <div
              key={tr.transformer_id}
              onClick={() => setSelectedTrId(tr.transformer_id)}
              className={`p-5 rounded-xl border cursor-pointer transition glow-card relative overflow-hidden ${
                isSelected
                  ? 'bg-electric-500/10 border-electric-500/60 shadow-lg'
                  : 'bg-navy-900 border-navy-800 hover:border-navy-700'
              }`}
            >
              {isCritical && (
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg tracking-wider uppercase">
                  High Risk Hub
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-white text-base">{tr.transformer_id}</span>
                <RiskBadge level={tr.priority_level} score={tr.priority_score} />
              </div>

              <p className="text-xs text-slate-300 font-semibold">{tr.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{tr.location} • Feeder: {tr.feeder_id}</p>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-navy-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Discrepancy</span>
                  <p className={`font-mono font-bold ${tr.discrepancy_pct > 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tr.discrepancy_pct}% ({tr.discrepancy_kwh} kWh)
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Suspicious Consumers</span>
                  <p className="font-mono font-bold text-orange-400">
                    {tr.suspicious_consumers} / {tr.total_consumers}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Transformer Deep-Dive */}
      {trDetail && (
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-navy-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white font-mono">{trDetail.transformer_summary.transformer_id}</h3>
                <span className="text-xs text-slate-400">• {trDetail.transformer_summary.name}</span>
                <RiskBadge level={trDetail.transformer_summary.priority_level} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{trDetail.transformer_summary.location} • Capacity: {trDetail.transformer_summary.capacity_kva} kVA</p>
            </div>

            <div className="flex items-center gap-4 bg-navy-950 px-4 py-2 rounded-xl border border-navy-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">TR Input</span>
                <p className="text-sm font-bold text-white font-mono">{trDetail.transformer_summary.input_energy_kwh} kWh</p>
              </div>
              <div className="h-6 w-px bg-navy-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Consumer Sum</span>
                <p className="text-sm font-bold text-emerald-400 font-mono">{trDetail.transformer_summary.total_consumer_kwh} kWh</p>
              </div>
              <div className="h-6 w-px bg-navy-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Unaccounted Gap</span>
                <p className="text-sm font-bold text-red-400 font-mono">
                  {trDetail.transformer_summary.discrepancy_kwh} kWh ({trDetail.transformer_summary.discrepancy_pct}%)
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Engineering Explanation */}
          <div className="p-4 bg-navy-950/80 border border-navy-800 rounded-xl text-xs">
            <h4 className="font-bold text-electric-400 uppercase tracking-wider text-[11px] mb-1">
              Automated Transformer Engineering Assessment:
            </h4>
            <p className="text-slate-300 leading-relaxed font-mono">
              "{trDetail.transformer_summary.explanation || 'Transformer within expected operational tolerances.'}"
            </p>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              Note: Do not assume every consumer connected to a suspicious transformer is involved in unauthorized consumption. Unaccounted energy requires targeted physical verification.
            </p>
          </div>

          {/* Historical Daily Trend */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-electric-400" />
              Historical Transformer Energy Balance & Discrepancy % (Daily)
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trDetail.daily_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickFormatter={(v) => v ? v.slice(5) : ''} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="input_kwh" name="TR Input (kWh)" stroke="#38BDF8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="consumer_kwh" name="Consumer Accounted (kWh)" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="discrepancy_pct" name="Discrepancy %" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Connected Consumers on this Transformer */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-electric-400" />
              Connected Consumers ({trDetail.connected_consumers?.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-navy-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                  <tr>
                    <th className="py-2.5 px-3">Consumer ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Load</th>
                    <th className="py-2.5 px-3">Total Consumed</th>
                    <th className="py-2.5 px-3">Alerts</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-300">
                  {trDetail.connected_consumers?.map((c) => (
                    <tr key={c.consumer_id} className="hover:bg-navy-800/40">
                      <td className="py-2 px-3 font-mono font-semibold text-white">{c.consumer_id}</td>
                      <td className="py-2 px-3">{c.name}</td>
                      <td className="py-2 px-3 text-slate-400">{c.category}</td>
                      <td className="py-2 px-3 font-mono text-electric-400">{c.connected_load_capacity} kW</td>
                      <td className="py-2 px-3 font-mono">{c.total_kwh} kWh</td>
                      <td className="py-2 px-3">
                        {c.alert_count > 0 ? (
                          <span className="font-bold text-red-400 font-mono">{c.alert_count} active</span>
                        ) : (
                          <span className="text-slate-500 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <RiskBadge level={c.risk_level || 'Low'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
