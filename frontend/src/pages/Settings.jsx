import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Cpu,
  Database,
  Sliders
} from 'lucide-react';

export default function Settings({ onDataReset }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [tariff, setTariff] = useState('7.50');
  const [contamination, setContamination] = useState('0.08');
  const [criticalThreshold, setCriticalThreshold] = useState('80.0');
  const [highThreshold, setHighThreshold] = useState('60.0');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      if (data.default_tariff_inr) setTariff(data.default_tariff_inr.value);
      if (data.anomaly_contamination) setContamination(data.anomaly_contamination.value);
      if (data.critical_risk_threshold) setCriticalThreshold(data.critical_risk_threshold.value);
      if (data.high_risk_threshold) setHighThreshold(data.high_risk_threshold.value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSetting('default_tariff_inr', tariff);
      await api.updateSetting('anomaly_contamination', contamination);
      await api.updateSetting('critical_risk_threshold', criticalThreshold);
      await api.updateSetting('high_risk_threshold', highThreshold);
      setToast({ type: 'success', message: 'System settings saved successfully.' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSampleData = async () => {
    if (!window.confirm("Are you sure you want to reset the database? All custom readings will be cleared and replaced with realistic power grid sample data.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await api.resetSampleData();
      setToast({ type: 'success', message: res.message });
      if (onDataReset) onDataReset();
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-electric-400" />
          System Settings & Engineering Thresholds
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure financial exposure tariff constants, Isolation Forest hyperparameters, and risk score boundaries.
        </p>
      </div>

      {toast && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/15 border border-red-500/30 text-red-400'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveAll} className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-navy-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-electric-400" />
            Grid Economics & ML Hyperparameters
          </h3>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tariff Config */}
          <div className="bg-navy-950/60 border border-navy-800 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              Default Electricity Tariff (₹ / kWh)
            </label>
            <p className="text-[11px] text-slate-400">
              Used to calculate financial exposure from unaccounted energy across feeders and transformers.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm font-bold text-electric-400">₹</span>
              <input
                type="number"
                step="0.10"
                min="1.0"
                max="25.0"
                required
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                className="w-32 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-slate-400">per kWh</span>
            </div>
          </div>

          {/* Anomaly Contamination */}
          <div className="bg-navy-950/60 border border-navy-800 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              Isolation Forest Contamination Rate
            </label>
            <p className="text-[11px] text-slate-400">
              Expected proportion of anomalous consumption points in the distribution network (default: 0.08 = 8%).
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.30"
                required
                value={contamination}
                onChange={(e) => setContamination(e.target.value)}
                className="w-32 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-slate-400 font-mono">(0.01 to 0.30)</span>
            </div>
          </div>

          {/* Critical Risk Score Boundary */}
          <div className="bg-navy-950/60 border border-navy-800 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              Critical Risk Tier Threshold (0 - 100)
            </label>
            <p className="text-[11px] text-slate-400">
              Consumers scoring at or above this threshold trigger Critical priority alerts for immediate site dispatch.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                step="1"
                min="50"
                max="95"
                required
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(e.target.value)}
                className="w-32 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-red-400 font-semibold">Critical Priority</span>
            </div>
          </div>

          {/* High Risk Score Boundary */}
          <div className="bg-navy-950/60 border border-navy-800 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              High Risk Tier Threshold (0 - 100)
            </label>
            <p className="text-[11px] text-slate-400">
              Consumers scoring at or above this threshold are ranked for inspection within 48 hours.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                step="1"
                min="40"
                max="80"
                required
                value={highThreshold}
                onChange={(e) => setHighThreshold(e.target.value)}
                className="w-32 bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold"
              />
              <span className="text-xs text-orange-400 font-semibold">High Priority</span>
            </div>
          </div>
        </div>
      </form>

      {/* Database Reset Action */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-electric-400" />
              Reset & Seed Sample Power Grid Dataset
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Clears the SQLite database and regenerates a full 7-day multi-feeder, multi-transformer benchmark grid with residential, commercial, industrial loads and simulated anomalies.
            </p>
          </div>
          <button
            onClick={handleResetSampleData}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting Database...' : 'Reset to Default Sample Data'}
          </button>
        </div>
      </div>

      {/* Strict Architecture & Scope Disclosure */}
      <div className="bg-navy-950 border border-navy-800 rounded-xl p-5 text-xs space-y-3">
        <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Technical Stack & Regulatory Compliance Disclosure:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-400 text-[11px]">
          <div>
            <span className="text-white font-semibold block mb-0.5">Frontend Stack</span>
            <p>React.js, Vite, Tailwind CSS, Recharts, Lucide React.</p>
          </div>
          <div>
            <span className="text-white font-semibold block mb-0.5">Backend & Database</span>
            <p>Python FastAPI REST APIs, SQLite primary relational storage.</p>
          </div>
          <div>
            <span className="text-white font-semibold block mb-0.5">Machine Learning</span>
            <p>Scikit-Learn Isolation Forest, Random Forest Classifier, NumPy, Pandas.</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 pt-2 border-t border-navy-850">
          VoltGuard AI is a software prototype designed for anomaly detection and inspection prioritization. Discrepancies and anomaly scores are probabilistic risk indicators, not judicial proof of electricity theft.
        </p>
      </div>
    </div>
  );
}
