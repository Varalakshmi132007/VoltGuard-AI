import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import {
  Zap,
  Users,
  GitBranch,
  Cpu,
  AlertTriangle,
  IndianRupee,
  ShieldCheck,
  TrendingDown,
  Activity,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function Dashboard({ onNavigate, refreshKey }) {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, chartRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardCharts()
      ]);
      setSummary(sumRes);
      setCharts(chartRes);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [refreshKey]);

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <div className="w-10 h-10 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Querying VoltGuard AI database & ML metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-400">
        <h3 className="font-bold text-sm">Failed to load dashboard metrics</h3>
        <p className="text-xs mt-1">{error}</p>
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const categoryColors = ['#38BDF8', '#818CF8', '#F59E0B'];

  return (
    <div className="space-y-6">
      {/* Top Banner & Highlights */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-navy-700/80 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-electric-400 animate-ping" />
              <span className="text-xs font-semibold text-electric-400 tracking-wider uppercase">
                Grid Intelligence Engine Active
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Real-time Consumption & Loss Supervision
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Synthesizing consumer-level Isolation Forest anomaly vectors with feeder-level and transformer-level mass energy balance.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-navy-950/80 border border-navy-800 px-4 py-3 rounded-xl shrink-0">
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-medium">Assumed Tariff</p>
              <p className="text-lg font-bold text-electric-400">₹{summary?.assumed_tariff_inr?.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ kWh</span></p>
            </div>
            <div className="h-8 w-px bg-navy-800" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-medium">Financial Exposure</p>
              <p className="text-lg font-bold text-red-400">₹{summary?.estimated_financial_exposure_inr?.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid (12 required indicators) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Consumption"
          value={`${summary?.total_consumption_kwh?.toLocaleString()} kWh`}
          subtext="Aggregated consumer metered energy"
          icon={Zap}
          color="blue"
        />
        <StatCard
          title="Total Consumers"
          value={summary?.total_consumers}
          subtext={`Res: ${summary?.residential_consumers} | Com: ${summary?.commercial_consumers} | Ind: ${summary?.industrial_consumers}`}
          icon={Users}
          color="emerald"
        />
        <StatCard
          title="Feeders & Transformers"
          value={`${summary?.total_feeders} Fdr / ${summary?.total_transformers} TR`}
          subtext="Distribution grid nodes"
          icon={GitBranch}
          color="purple"
        />
        <StatCard
          title="Suspicious Consumers"
          value={summary?.suspicious_consumers}
          subtext={`${summary?.normal_consumers} Normal consumers`}
          icon={AlertTriangle}
          color="orange"
          badge={
            <span className="text-orange-400 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('theft')}>
              Prioritize Inspections →
            </span>
          }
        />
        <StatCard
          title="Total Anomalies"
          value={summary?.total_anomalies_detected}
          subtext="Isolation Forest flagged readings"
          icon={Activity}
          color="red"
          badge={
            <span className="text-red-400 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('detection')}>
              View AI Detections →
            </span>
          }
        />
        <StatCard
          title="Unaccounted Energy"
          value={`${summary?.total_unaccounted_energy_kwh?.toLocaleString()} kWh`}
          subtext={`High-Risk TRs: ${summary?.high_risk_transformers}`}
          icon={IndianRupee}
          color="red"
          badge={
            <span className="text-electric-400 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('monitoring')}>
              Energy Balance →
            </span>
          }
        />
      </div>

      {/* Chart Row 1: Hourly Consumption & Daily Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Hourly Consumption */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Hourly Electricity Consumption
              </h3>
              <p className="text-xs text-slate-400">Total consumer draw over past 24 hours</p>
            </div>
            <span className="text-xs text-electric-400 font-mono">Unit: kWh</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.hourly_consumption || []}>
                <defs>
                  <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="time_label" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="consumption_kwh" stroke="#38BDF8" strokeWidth={2} fillOpacity={1} fill="url(#colorHourly)" name="Consumption (kWh)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Daily Consumption */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Daily Electricity Consumption
              </h3>
              <p className="text-xs text-slate-400">Aggregated daily energy volume across all meters</p>
            </div>
            <span className="text-xs text-emerald-400 font-mono">Unit: kWh</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.daily_consumption || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date_label" stroke="#64748B" fontSize={11} tickFormatter={(val) => val ? val.slice(5) : ''} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="total_kwh" fill="#10B981" radius={[4, 4, 0, 0]} name="Total Daily (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Row 2: Discrepancy Charts (Feeder-wise & Transformer-wise) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7. Transformer-wise Energy Discrepancy */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                7. Transformer-wise Energy Discrepancy
              </h3>
              <p className="text-xs text-slate-400">Transformer input vs downstream consumer meters</p>
            </div>
            <span className="text-xs text-amber-400 font-semibold">T-102 High Priority</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.transformer_discrepancy || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="transformer_id" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="input_kwh" fill="#38BDF8" name="TR Input (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consumer_kwh" fill="#10B981" name="Consumer Accounted (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="discrepancy_kwh" fill="#EF4444" name="Unaccounted (kWh)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8. Feeder-wise Energy Discrepancy */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                8. Feeder-wise Energy Discrepancy
              </h3>
              <p className="text-xs text-slate-400">Feeder input vs transformer accounted output</p>
            </div>
            <span className="text-xs text-purple-400 font-mono">Formula: Input - Accounted</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.feeder_discrepancy || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="feeder_id" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="input_kwh" fill="#818CF8" name="Feeder Input (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="accounted_kwh" fill="#10B981" name="Accounted Output (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="discrepancy_kwh" fill="#F97316" name="Unaccounted Loss (kWh)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Row 3: Category Comparison, Normal vs Abnormal, Suspicious Trends, Risk Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 4. Consumer Category Comparison */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            4. Category Volume
          </h3>
          <p className="text-xs text-slate-400 mb-3">Residential vs Commercial vs Industrial</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.category_comparison || []}
                  dataKey="total_kwh"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                >
                  {(charts?.category_comparison || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around text-[11px] text-slate-300 mt-2">
            {(charts?.category_comparison || []).map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[i % categoryColors.length] }} />
                {c.category}
              </span>
            ))}
          </div>
        </div>

        {/* 5. Normal vs Abnormal Readings */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            5. Normal vs Abnormal
          </h3>
          <p className="text-xs text-slate-400 mb-3">Isolation Forest classification ratio</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.normal_vs_abnormal || []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                >
                  {(charts?.normal_vs_abnormal || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around text-[11px] text-slate-300 mt-2">
            {(charts?.normal_vs_abnormal || []).map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.status} ({c.count})
              </span>
            ))}
          </div>
        </div>

        {/* 6. Suspicious Activity Trends */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            6. Suspicious Activity Trend
          </h3>
          <p className="text-xs text-slate-400 mb-3">Daily flagged anomaly volume</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts?.suspicious_trends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date_label" stroke="#64748B" fontSize={10} tickFormatter={(val) => val ? val.slice(5) : ''} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="anomaly_count" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Anomalies" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 9. Risk Distribution */}
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5 glow-card">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            9. Risk Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-3">Consumer priority rating tiers</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.risk_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="level" stroke="#64748B" fontSize={9} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="count" name="Alerts Count" radius={[4, 4, 0, 0]}>
                  {(charts?.risk_distribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
