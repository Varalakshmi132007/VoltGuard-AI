import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import ConsumerDetailModal from '../components/ConsumerDetailModal';
import {
  ScanSearch,
  Play,
  Filter,
  Eye,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles
} from 'lucide-react';

export default function AnomalyDetection() {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningModel, setRunningModel] = useState(false);
  const [contamination, setContamination] = useState(0.08);
  const [filterType, setFilterType] = useState('all');
  const [selectedConsumerId, setSelectedConsumerId] = useState(null);
  const [runMessage, setRunMessage] = useState(null);

  const loadDetections = async () => {
    try {
      setLoading(true);
      const data = await api.getDetections({ is_anomaly_only: true, limit: 100 });
      setDetections(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetections();
  }, []);

  const handleRunModel = async () => {
    try {
      setRunningModel(true);
      setRunMessage(null);
      const res = await api.runAnomalyDetection(contamination);
      setRunMessage(`Detection completed: Analyzed ${res.total_readings_analyzed} readings. Flagged ${res.anomalies_detected} anomalies (${res.anomaly_rate_pct}% anomaly rate).`);
      loadDetections();
    } catch (err) {
      setRunMessage(`Model error: ${err.message}`);
    } finally {
      setRunningModel(false);
    }
  };

  const filteredDetections = detections.filter(d => {
    if (filterType === 'surge') return d.deviation_pct > 60;
    if (filterType === 'drop') return d.deviation_pct < -50;
    if (filterType === 'off_hours') return d.detection_result?.includes('Off-Hours');
    if (filterType === 'factor') return d.detection_result?.includes('Factor');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ScanSearch className="w-5 h-5 text-electric-400" />
            AI Anomaly Detection (Scikit-Learn Isolation Forest)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Learning individual consumer normal baselines (stratified by hour, category, load & weekend) rather than rigid universal thresholds.
          </p>
        </div>

        {/* Model Trigger */}
        <div className="flex items-center gap-3 bg-navy-900 border border-navy-700/80 p-2.5 rounded-xl self-start md:self-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Contamination:</span>
            <input
              type="number"
              min="0.01"
              max="0.25"
              step="0.01"
              value={contamination}
              onChange={(e) => setContamination(parseFloat(e.target.value))}
              className="w-16 bg-navy-950 border border-navy-800 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
          <button
            onClick={handleRunModel}
            disabled={runningModel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/30 transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningModel ? 'animate-spin' : ''}`} />
            {runningModel ? 'Executing Isolation Forest...' : 'Retrain & Run Detection'}
          </button>
        </div>
      </div>

      {runMessage && (
        <div className="p-3 bg-electric-500/10 border border-electric-500/30 rounded-xl text-xs text-electric-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-electric-400 shrink-0" />
          <span>{runMessage}</span>
        </div>
      )}

      {/* Explanatory Methodology Card */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-5">
        <div className="flex items-center gap-2 text-electric-400 mb-2">
          <Info className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Consumer-Specific Normal Baseline Learning Architecture:
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800">
            <p className="font-semibold text-slate-200 mb-0.5">1. Historical Stratification</p>
            <p className="text-[11px]">Computes mean and variation per (consumer_id, hour_of_day, weekday/weekend) rather than assuming equal household draw.</p>
          </div>
          <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800">
            <p className="font-semibold text-slate-200 mb-0.5">2. Multi-Dimensional Features</p>
            <p className="text-[11px]">Isolation Forest evaluates load ratio (kWh / Sanctioned Load), deviation %, power factor, and operating schedules.</p>
          </div>
          <div className="bg-navy-950/60 p-3 rounded-lg border border-navy-800">
            <p className="font-semibold text-slate-200 mb-0.5">3. Human-Readable Explanations</p>
            <p className="text-[11px]">Dynamic explanation engine generates contextual diagnosis for electrical utility engineering review.</p>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Filter Anomaly Types:</span>
        {[
          { id: 'all', label: `All Anomalies (${detections.length})` },
          { id: 'drop', label: 'Unusual Reductions / Bypass' },
          { id: 'surge', label: 'Sudden Surges (>60%)' },
          { id: 'off_hours', label: 'Off-Hours Anomalies' },
          { id: 'factor', label: 'Power Factor Irregularities' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterType === f.id
                ? 'bg-electric-500/20 text-electric-300 border border-electric-500/40'
                : 'bg-navy-900 text-slate-400 hover:text-white border border-navy-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Detections Table */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Consumer & Meter</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actual (kWh)</th>
                <th className="py-3 px-4">Baseline (kWh)</th>
                <th className="py-3 px-4">Deviation %</th>
                <th className="py-3 px-4">Anomaly Score</th>
                <th className="py-3 px-4">Detection Result</th>
                <th className="py-3 px-4">Explanation</th>
                <th className="py-3 px-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying anomaly detections...
                  </td>
                </tr>
              ) : filteredDetections.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No detections matching the active filter.
                  </td>
                </tr>
              ) : (
                filteredDetections.map((d) => (
                  <tr key={d.id} className="hover:bg-navy-800/40 transition">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{d.name}</p>
                      <p className="text-[11px] font-mono text-slate-400">{d.consumer_id} • {d.category}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {d.timestamp}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {d.actual_kwh}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {d.expected_kwh}
                    </td>
                    <td className={`py-3 px-4 font-mono font-bold ${
                      d.deviation_pct > 60 ? 'text-red-400' : d.deviation_pct < -50 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {d.deviation_pct > 0 ? `+${d.deviation_pct}%` : `${d.deviation_pct}%`}
                    </td>
                    <td className="py-3 px-4 font-mono text-electric-400 font-semibold">
                      {d.anomaly_score?.toFixed(3)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
                        {d.detection_result}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-[11px] max-w-xs leading-relaxed">
                      {d.explanation}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedConsumerId(d.consumer_id)}
                        className="p-1.5 text-slate-400 hover:text-electric-400 rounded hover:bg-navy-800 transition"
                        title="Inspect Individual Load Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
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
