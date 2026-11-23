import React, { useState } from 'react';
import { Play, Flame, RefreshCw, Bell, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';

export default function Topbar({ onRefreshData, activeAlertsCount = 0, onNavigate }) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [scenario, setScenario] = useState('Sudden_Drop_Meter_Bypass');
  const [toastMsg, setToastMsg] = useState(null);

  const showNotification = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleStepSimulation = async () => {
    try {
      setIsSimulating(true);
      const res = await api.advanceSimulation(1);
      showNotification(`Simulation advanced to ${res.simulated_timestamp}. Analyzed ${res.readings_added} readings.`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      showNotification(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleInjectScenario = async () => {
    try {
      setIsInjecting(true);
      const res = await api.injectSuspicious(scenario);
      setShowInjectModal(false);
      showNotification(`Injected ${res.activity_type} for ${res.consumer_id}! Risk Score: ${res.risk_score} (${res.risk_level})`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      showNotification(`Injection error: ${err.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <header className="h-16 bg-navy-900/90 backdrop-blur-md border-b border-navy-700/60 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left Title / Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold tracking-wider">
            DEMO / SIMULATED DATA
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-400">
            • Grid Research Prototype
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Step Simulation Button */}
        <button
          onClick={handleStepSimulation}
          disabled={isSimulating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 hover:border-slate-500 transition shadow-sm disabled:opacity-50"
          title="Advances simulation time and generates new smart meter readings"
        >
          <Play className={`w-3.5 h-3.5 text-electric-400 ${isSimulating ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Start Live Simulation</span>
          <span className="md:hidden">Simulate</span>
        </button>

        {/* Inject Suspicious Activity Button */}
        <button
          onClick={() => setShowInjectModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition shadow-sm"
          title="Inject realistic power theft / tampering scenario"
        >
          <Flame className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden md:inline">Simulate Suspicious Activity</span>
          <span className="md:hidden">Inject</span>
        </button>

        {/* Refresh */}
        <button
          onClick={onRefreshData}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 border border-transparent hover:border-navy-700 transition"
          title="Refresh Dashboard Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Alerts Bell */}
        <button
          onClick={() => onNavigate && onNavigate('alerts')}
          className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 border border-transparent hover:border-navy-700 transition"
          title="View Active Theft Alerts"
        >
          <Bell className="w-4 h-4" />
          {activeAlertsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 bg-navy-800 border border-electric-500/40 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-electric-400 shrink-0" />
          <span className="text-xs font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Inject Modal */}
      {showInjectModal && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-navy-800">
              <div className="flex items-center gap-2 text-red-400">
                <Flame className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white">Inject Suspicious Power Scenario</h3>
              </div>
              <button
                onClick={() => setShowInjectModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Inject a realistic anomalous electricity pattern into the active grid. The Isolation Forest detector and risk engine will flag the reading and calculate inspection priorities.
            </p>

            <div className="mt-4 space-y-3">
              <label className="text-xs font-medium text-slate-300 block">Select Anomaly / Theft Scenario:</label>
              <div className="space-y-2">
                {[
                  { id: 'Sudden_Drop_Meter_Bypass', label: 'Sudden Drop / Meter Bypass', desc: 'Meter records drops ~85% while upstream line current continues.' },
                  { id: 'Low_Power_Factor_Tampering', label: 'Low Power Factor / Phase Shunt', desc: 'Current shunt tampering causing degraded PF (0.48) and erratic readings.' },
                  { id: 'Sudden_Spike', label: 'Sudden Consumption Surge', desc: 'Unexpected 280% overload outside sanctioned capacity during off-peak.' },
                  { id: 'Suspicious_Load_Variation', label: 'Suspicious Off-Hours Fluctuation', desc: 'Abnormal high-frequency load switching in quiet nighttime hours.' }
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      scenario === item.id
                        ? 'bg-red-500/10 border-red-500/40 text-slate-100'
                        : 'bg-navy-950/50 border-navy-800 text-slate-400 hover:border-navy-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scenario"
                      checked={scenario === item.id}
                      onChange={() => setScenario(item.id)}
                      className="mt-0.5 text-red-500 focus:ring-0"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{item.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-navy-800">
              <button
                onClick={() => setShowInjectModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleInjectScenario}
                disabled={isInjecting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-red-600/30 transition disabled:opacity-50"
              >
                {isInjecting ? 'Injecting Scenario...' : 'Execute Anomaly Injection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
