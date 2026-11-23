import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import {
  Activity,
  IndianRupee,
  Layers,
  TrendingDown,
  Info,
  Sliders,
  CheckCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function EnergyMonitoring({ onNavigate }) {
  const [exposureData, setExposureData] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customTariff, setCustomTariff] = useState(7.50);
  const [savingTariff, setSavingTariff] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [exp, net] = await Promise.all([
        api.getFinancialExposure(),
        api.getNetworkOverview()
      ]);
      setExposureData(exp);
      setNetworkData(net);
      setCustomTariff(exp.assumed_tariff_inr_per_kwh || 7.50);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateTariff = async () => {
    try {
      setSavingTariff(true);
      await api.updateSetting('default_tariff_inr', String(customTariff));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      loadData();
    } catch (err) {
      alert(`Tariff update error: ${err.message}`);
    } finally {
      setSavingTariff(false);
    }
  };

  if (loading && !exposureData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <div className="w-8 h-8 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Computing energy discrepancy & financial exposure...</p>
      </div>
    );
  }

  // Live recalculate with custom slider tariff
  const liveFinancialExposure = Math.round((exposureData?.total_unaccounted_energy_kwh || 0) * customTariff);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-electric-400" />
            Grid Energy Balance & Financial Exposure
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking mass energy flow from substation feeders to distribution transformers and consumer meters.
          </p>
        </div>

        {/* Disclaimer Pill */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-amber-300 flex items-center gap-2 self-start md:self-auto">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Engineering discrepancy: includes technical resistance losses (~3-5%) and potential unauthorized usage.</span>
        </div>
      </div>

      {/* Grid Flow Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Feeder Input Energy"
          value={`${networkData?.total_feeder_input_kwh?.toLocaleString()} kWh`}
          subtext="Total energy injected into transmission lines"
          icon={Layers}
          color="blue"
        />
        <StatCard
          title="Transformer Output"
          value={`${networkData?.total_transformer_output_kwh?.toLocaleString()} kWh`}
          subtext={`Transmission line loss: ${networkData?.transmission_loss_pct}%`}
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="Accounted Consumer Draw"
          value={`${networkData?.total_consumer_metered_kwh?.toLocaleString()} kWh`}
          subtext="Summed consumer billing meters"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Distribution Gap"
          value={`${exposureData?.total_unaccounted_energy_kwh?.toLocaleString()} kWh`}
          subtext={`Loss rate: ${networkData?.distribution_unaccounted_pct}%`}
          icon={TrendingDown}
          color="red"
        />
      </div>

      {/* Interactive Financial Exposure Module */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-850 border border-navy-700/80 rounded-2xl p-6 glow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <IndianRupee className="w-5 h-5" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Financial Exposure Estimation Engine
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Calculated using: <span className="font-mono text-slate-200">Financial Exposure = Unaccounted Energy (kWh) × Assumed Tariff (₹/kWh)</span>.
              Monetary values represent financial loss exposure requiring field audit, not guaranteed recoverable theft.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Adjust Assumed Electricity Tariff (₹/kWh):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="4.0"
                    max="15.0"
                    step="0.25"
                    value={customTariff}
                    onChange={(e) => setCustomTariff(parseFloat(e.target.value))}
                    className="w-48 accent-electric-400 cursor-pointer"
                  />
                  <span className="font-mono text-sm font-bold text-electric-400 px-2 py-0.5 rounded bg-navy-950 border border-navy-800">
                    ₹{customTariff.toFixed(2)}
                  </span>
                  <button
                    onClick={handleUpdateTariff}
                    disabled={savingTariff}
                    className="px-3 py-1 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {savingTariff ? 'Saving...' : 'Set as Default'}
                  </button>
                  {savedSuccess && (
                    <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                      Saved!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-navy-950/80 border border-navy-800 p-5 rounded-xl min-w-[280px] shrink-0 text-right">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Estimated Total Exposure
            </span>
            <div className="text-3xl font-extrabold text-red-400 mt-1 tracking-tight">
              ₹{liveFinancialExposure.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Based on {exposureData?.total_unaccounted_energy_kwh?.toLocaleString()} kWh unaccounted
            </p>
          </div>
        </div>
      </div>

      {/* Exposure Breakdown by Transformer & Feeder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transformer Exposure Table */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Transformer-wise Exposure & Priority
              </h3>
              <p className="text-xs text-slate-400">Ranked by unaccounted monetary exposure</p>
            </div>
            <button
              onClick={() => onNavigate('transformers')}
              className="text-xs text-electric-400 hover:underline flex items-center gap-1"
            >
              All Transformers <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-navy-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                <tr>
                  <th className="py-2.5 px-3">Transformer</th>
                  <th className="py-2.5 px-3">Unaccounted</th>
                  <th className="py-2.5 px-3">Discrepancy %</th>
                  <th className="py-2.5 px-3">Est. Value (₹)</th>
                  <th className="py-2.5 px-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-slate-300">
                {exposureData?.transformer_wise_exposure?.map((tr) => (
                  <tr key={tr.transformer_id} className="hover:bg-navy-800/40">
                    <td className="py-2 px-3">
                      <p className="font-semibold text-white font-mono">{tr.transformer_id}</p>
                      <p className="text-[10px] text-slate-400">{tr.name}</p>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-300">{tr.unaccounted_kwh} kWh</td>
                    <td className={`py-2 px-3 font-semibold ${tr.discrepancy_pct > 10 ? 'text-red-400' : 'text-slate-300'}`}>
                      {tr.discrepancy_pct}%
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-red-400">
                      ₹{Math.round(tr.unaccounted_kwh * customTariff).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        tr.priority_level === 'Critical'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : tr.priority_level === 'High'
                          ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {tr.priority_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feeder Exposure Table */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Feeder-wise Exposure & Status
              </h3>
              <p className="text-xs text-slate-400">Substation transmission line balance</p>
            </div>
            <button
              onClick={() => onNavigate('feeders')}
              className="text-xs text-electric-400 hover:underline flex items-center gap-1"
            >
              All Feeders <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-navy-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                <tr>
                  <th className="py-2.5 px-3">Feeder</th>
                  <th className="py-2.5 px-3">Unaccounted</th>
                  <th className="py-2.5 px-3">Discrepancy %</th>
                  <th className="py-2.5 px-3">Est. Value (₹)</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-slate-300">
                {exposureData?.feeder_wise_exposure?.map((fdr) => (
                  <tr key={fdr.feeder_id} className="hover:bg-navy-800/40">
                    <td className="py-2 px-3">
                      <p className="font-semibold text-white font-mono">{fdr.feeder_id}</p>
                      <p className="text-[10px] text-slate-400">{fdr.name}</p>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-300">{fdr.unaccounted_kwh} kWh</td>
                    <td className={`py-2 px-3 font-semibold ${fdr.discrepancy_pct > 8 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {fdr.discrepancy_pct}%
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-red-400">
                      ₹{Math.round(fdr.unaccounted_kwh * customTariff).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        fdr.status === 'High Discrepancy'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : fdr.status === 'Elevated'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {fdr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
