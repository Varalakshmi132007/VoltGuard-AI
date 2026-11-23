import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  FileCheck,
  XCircle,
  HelpCircle,
  MessageSquare,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';

export default function AlertsInvestigations({ onAlertUpdated }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // Selected Alert for Investigation Workflow
  const [activeAlert, setActiveAlert] = useState(null);
  const [activeHistory, setActiveHistory] = useState([]);
  const [newStatus, setNewStatus] = useState('Under Investigation');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (riskFilter) params.risk_level = riskFilter;
      const data = await api.getAlerts(params);
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, riskFilter]);

  const openAlertModal = async (alertItem) => {
    setActiveAlert(alertItem);
    setNewStatus(alertItem.investigation_status);
    setRemarks(alertItem.notes || '');
    setFeedback(null);
    try {
      const detail = await api.getAlertDetail(alertItem.id);
      setActiveHistory(detail.investigation_history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!activeAlert) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await api.updateAlertStatus(activeAlert.id, {
        investigation_status: newStatus,
        remarks: remarks || 'Status updated from investigation dashboard.',
        updated_by: 'Utility Field Inspector'
      });
      setFeedback({ type: 'success', message: `Status updated to '${newStatus}' successfully.` });
      setTimeout(() => {
        setActiveAlert(null);
        loadAlerts();
        if (onAlertUpdated) onAlertUpdated();
      }, 1000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Alerts & Investigation Case Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track, audit, and update investigation lifecycle statuses with full audit trail logging.
          </p>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Status:
          </span>
          {['', 'Pending Investigation', 'Under Investigation', 'Resolved', 'False Alarm'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === st
                  ? 'bg-electric-500/20 text-electric-300 border border-electric-500/40'
                  : 'bg-navy-950 text-slate-400 hover:text-white border border-navy-800'
              }`}
            >
              {st || 'All Statuses'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Risk Tier:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
          >
            <option value="">All Tiers</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Alert Code</th>
                <th className="py-3 px-4">Consumer & Grid</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Activity Category</th>
                <th className="py-3 px-4">Actual vs Expected</th>
                <th className="py-3 px-4">Risk Priority</th>
                <th className="py-3 px-4">Investigation Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No alerts match the chosen filters.
                  </td>
                </tr>
              ) : (
                alerts.map((alt) => (
                  <tr key={alt.id} className="hover:bg-navy-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {alt.alert_code}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-200">{alt.consumer_id}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{alt.transformer_id} • {alt.feeder_id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {alt.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-200">{alt.activity_type}</span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="font-bold text-white">{alt.actual_kwh}</span>
                      <span className="text-slate-400"> / {alt.expected_kwh} kWh</span>
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge level={alt.risk_level} score={alt.risk_score} />
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        alt.investigation_status === 'Pending Investigation'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : alt.investigation_status === 'Under Investigation'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : alt.investigation_status === 'Resolved'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }`}>
                        {alt.investigation_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openAlertModal(alt)}
                        className="px-3 py-1 bg-navy-950 border border-navy-800 hover:border-electric-500 text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Status Management Modal */}
      {activeAlert && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800 mb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-electric-400" />
                  Investigation Case: {activeAlert.alert_code}
                </h3>
                <p className="text-xs text-slate-400">Target Consumer: {activeAlert.consumer_id} • Transformer: {activeAlert.transformer_id}</p>
              </div>
              <button
                onClick={() => setActiveAlert(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div className={`p-3 rounded-lg text-xs mb-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/15 border border-red-500/30 text-red-400'
              }`}>
                {feedback.message}
              </div>
            )}

            {/* Event Context & Explanation */}
            <div className="bg-navy-950/80 border border-navy-800 p-4 rounded-xl text-xs space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Detection Type: <strong className="text-white">{activeAlert.activity_type}</strong></span>
                <RiskBadge level={activeAlert.risk_level} score={activeAlert.risk_score} />
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-300">
                <span>Actual: {activeAlert.actual_kwh} kWh</span>
                <span>Baseline: {activeAlert.expected_kwh} kWh</span>
                <span>Anomaly Score: {activeAlert.anomaly_score}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px] pt-2 border-t border-navy-800/80">
                "{activeAlert.explanation}"
              </p>
            </div>

            {/* Audit History Log */}
            {activeHistory.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Audit Trail History</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {activeHistory.map((h) => (
                    <div key={h.id} className="bg-navy-950 p-2.5 rounded-lg border border-navy-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>{h.updated_by}</span>
                        <span className="font-mono text-[10px]">{h.timestamp}</span>
                      </div>
                      <p className="text-slate-200 mt-1">
                        Changed from <span className="font-semibold text-amber-400">{h.previous_status}</span> to <span className="font-semibold text-emerald-400">{h.new_status}</span>
                      </p>
                      {h.remarks && <p className="text-slate-400 italic mt-0.5">"{h.remarks}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Form */}
            <form onSubmit={handleUpdateStatus} className="space-y-3 pt-2 border-t border-navy-800">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Update Investigation Status:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-electric-500 font-semibold"
                >
                  <option value="Pending Investigation">Pending Investigation (Queued for site dispatch)</option>
                  <option value="Under Investigation">Under Investigation (Field technician on premise)</option>
                  <option value="Resolved">Resolved (Audit complete / Corrective action taken)</option>
                  <option value="False Alarm">False Alarm (Verified legitimate load variation)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Field Inspector Remarks / Technical Findings:
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Record physical meter inspection findings, seal check, shunt verification, or legitimate customer load reason..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-electric-500 placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/30 transition disabled:opacity-50"
                >
                  {submitting ? 'Recording Audit...' : 'Save Investigation Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
