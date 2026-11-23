import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  GitBranch,
  Layers,
  Activity,
  Cpu,
  TrendingDown,
  Info,
  Calendar,
  AlertTriangle
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

export default function FeederMonitoring() {
  const [feeders, setFeeders] = useState([]);
  const [selectedFeederId, setSelectedFeederId] = useState('FDR-NORTH-01');
  const [feederDetail, setFeederDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFeeders()
      .then((data) => {
        setFeeders(data);
        if (data.length > 0 && !selectedFeederId) {
          setSelectedFeederId(data[0].feeder_id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedFeederId) return;
    setLoading(true);
    api.getFeederDetail(selectedFeederId)
      .then((data) => {
        setFeederDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedFeederId]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-electric-400" />
          Feeder-Level Transmission Energy Accounting
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Feeder input metering vs aggregated transformer output. Formula: <span className="font-mono text-slate-200">Discrepancy % = (Input - Accounted) / Input × 100</span>.
        </p>
      </div>

      {/* Feeder Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {feeders.map((fdr) => (
          <div
            key={fdr.feeder_id}
            onClick={() => setSelectedFeederId(fdr.feeder_id)}
            className={`p-4 rounded-xl border cursor-pointer transition glow-card ${
              selectedFeederId === fdr.feeder_id
                ? 'bg-electric-500/10 border-electric-500/50 shadow-md'
                : 'bg-navy-900 border-navy-800 hover:border-navy-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-white text-sm">{fdr.feeder_id}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                fdr.discrepancy_pct > 8
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                {fdr.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">{fdr.name}</p>
            <div className="mt-3 pt-3 border-t border-navy-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Discrepancy:</span>
              <span className={`font-mono font-bold ${fdr.discrepancy_pct > 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fdr.discrepancy_pct}% ({fdr.unaccounted_energy_kwh} kWh)
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Feeder Detail & Historical Analysis */}
      {feederDetail && (
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-navy-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono">{feederDetail.feeder_summary.feeder_id}</h3>
                <span className="text-xs text-slate-400">• {feederDetail.feeder_summary.name}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{feederDetail.feeder_summary.location} • Capacity: {feederDetail.feeder_summary.capacity_kva} kVA</p>
            </div>
            <div className="flex items-center gap-4 bg-navy-950 px-4 py-2 rounded-xl border border-navy-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Input</span>
                <p className="text-sm font-bold text-white font-mono">{feederDetail.feeder_summary.input_energy_kwh} kWh</p>
              </div>
              <div className="h-6 w-px bg-navy-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Accounted Output</span>
                <p className="text-sm font-bold text-emerald-400 font-mono">{feederDetail.feeder_summary.total_accounted_energy_kwh} kWh</p>
              </div>
              <div className="h-6 w-px bg-navy-800" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Unaccounted Loss</span>
                <p className="text-sm font-bold text-red-400 font-mono">{feederDetail.feeder_summary.unaccounted_energy_kwh} kWh ({feederDetail.feeder_summary.discrepancy_pct}%)</p>
              </div>
            </div>
          </div>

          {/* Historical Trend Chart (Daily Breakdown) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-electric-400" />
                  Historical Discrepancy & Input vs Accounted Energy (Daily)
                </h4>
                <p className="text-[11px] text-slate-400">Comparing day-to-day transmission gap stability</p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feederDetail.daily_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickFormatter={(v) => v ? v.slice(5) : ''} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="input_kwh" name="Feeder Input (kWh)" stroke="#38BDF8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="accounted_kwh" name="Accounted TR Output (kWh)" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="discrepancy_pct" name="Discrepancy %" stroke="#EF4444" strokeWidth={2} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Connected Transformers Table */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-electric-400" />
              Connected Distribution Transformers ({feederDetail.connected_transformers?.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-navy-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                  <tr>
                    <th className="py-2.5 px-3">Transformer ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Rated Capacity</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-300">
                  {feederDetail.connected_transformers?.map((tr) => (
                    <tr key={tr.transformer_id} className="hover:bg-navy-800/40">
                      <td className="py-2 px-3 font-mono font-semibold text-white">{tr.transformer_id}</td>
                      <td className="py-2 px-3">{tr.name}</td>
                      <td className="py-2 px-3 text-slate-400">{tr.location}</td>
                      <td className="py-2 px-3 font-mono">{tr.capacity_kva} kVA</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {tr.status}
                        </span>
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
