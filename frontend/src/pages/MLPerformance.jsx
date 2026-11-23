import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import {
  BarChart3,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  ShieldCheck,
  Target
} from 'lucide-react';

export default function MLPerformance() {
  const [perf, setPerf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [toast, setToast] = useState(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await api.getModelPerformance();
      setPerf(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleReevaluate = async () => {
    try {
      setEvaluating(true);
      const res = await api.reEvaluateModels();
      setPerf(res);
      setToast('Re-evaluation completed on held-out chronological test split.');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(`Evaluation error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading && !perf) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <div className="w-8 h-8 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Computing Scikit-Learn evaluation matrices on held-out test split...</p>
      </div>
    );
  }

  const cmLabels = perf?.confusion_matrix?.labels || [];
  const cmMatrix = perf?.confusion_matrix?.matrix || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-electric-400" />
            Machine Learning Evaluation & Diagnostics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Supervised multi-class Random Forest evaluation computed on a chronological test partition.
          </p>
        </div>

        <button
          onClick={handleReevaluate}
          disabled={evaluating}
          className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
          {evaluating ? 'Evaluating Model...' : 'Re-run Benchmark Evaluation'}
        </button>
      </div>

      {toast && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Required Disclosure Banner */}
      <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-5 glow-card">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-electric-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Benchmark Dataset Disclosure (Academic / Research Standard):
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dataset Type: <strong className="text-electric-400">{perf?.dataset_type}</strong>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              VoltGuard AI strictly distinguishes between synthetic benchmarks and unlabelled field telemetry. Metrics shown below reflect true mathematical scikit-learn outputs on a held-out chronological test split (80% train, 20% test). No metrics are fabricated or randomized.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards (Accuracy, Precision, Recall, F1, FPR) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Accuracy"
          value={perf ? `${(perf.accuracy * 100).toFixed(1)}%` : '—'}
          subtext="Chronological test partition"
          icon={Target}
          color="emerald"
        />
        <StatCard
          title="Precision (Weighted)"
          value={perf ? `${(perf.precision * 100).toFixed(1)}%` : '—'}
          subtext="True positive / Predicted"
          icon={CheckCircle}
          color="blue"
        />
        <StatCard
          title="Recall (Sensitivity)"
          value={perf ? `${(perf.recall * 100).toFixed(1)}%` : '—'}
          subtext="True positive / Ground truth"
          icon={ShieldCheck}
          color="purple"
        />
        <StatCard
          title="F1-Score"
          value={perf ? `${(perf.f1_score * 100).toFixed(1)}%` : '—'}
          subtext="Harmonic precision-recall mean"
          icon={BarChart3}
          color="emerald"
        />
        <StatCard
          title="False Positive Rate"
          value={perf ? `${(perf.false_positive_rate * 100).toFixed(2)}%` : '—'}
          subtext="Normal incorrectly flagged"
          icon={AlertTriangle}
          color={perf?.false_positive_rate < 0.05 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Confusion Matrix Section */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-navy-800 gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-electric-400" />
              Multi-Class Confusion Matrix (Held-out Test Split)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Predicted Classes (Columns) vs Actual Ground-Truth Labels (Rows)
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Model: Random Forest (100 Trees, Balanced Weights)
          </span>
        </div>

        {/* Matrix Visualization Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                <th className="py-2.5 px-3 text-left">Actual Label \ Predicted</th>
                {cmLabels.map((lbl, i) => (
                  <th key={i} className="py-2.5 px-3">{lbl}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300 font-mono">
              {cmMatrix.map((row, rowIdx) => {
                const totalRow = row.reduce((a, b) => a + b, 0);
                return (
                  <tr key={rowIdx} className="hover:bg-navy-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white text-left font-sans text-xs">
                      {cmLabels[rowIdx]}
                    </td>
                    {row.map((val, colIdx) => {
                      const isDiagonal = rowIdx === colIdx;
                      const isPositive = val > 0;
                      let bgClass = 'bg-navy-950/40 text-slate-400';
                      if (isDiagonal && isPositive) {
                        bgClass = 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30';
                      } else if (!isDiagonal && isPositive) {
                        bgClass = 'bg-red-500/20 text-red-300 font-bold border border-red-500/30';
                      }

                      return (
                        <td key={colIdx} className="py-2.5 px-3">
                          <span className={`inline-block w-12 py-1 rounded text-xs ${bgClass}`}>
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-slate-400 pt-3 border-t border-navy-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
            <span>Diagonal: Correct Classifications</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span>Off-Diagonal: Misclassifications</span>
          </div>
        </div>
      </div>
    </div>
  );
}
