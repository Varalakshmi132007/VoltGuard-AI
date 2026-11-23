import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  FileText,
  Download,
  Calendar,
  Layers,
  Users,
  AlertTriangle,
  GitBranch,
  Cpu,
  CheckCircle2,
  Table
} from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('consumer_consumption');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const reportOptions = [
    { id: 'consumer_consumption', label: 'Consumer-wise Consumption', icon: Users, desc: 'Aggregated consumption, peak draw, and total reading counts per consumer.' },
    { id: 'daily_consumption', label: 'Daily Consumption Summary', icon: Calendar, desc: 'Day-by-day total grid energy, averages, and peak spikes.' },
    { id: 'weekly_consumption', label: 'Weekly Consumption Summary', icon: Calendar, desc: 'Aggregated weekly consumption trends and comparative volume.' },
    { id: 'monthly_consumption', label: 'Monthly Consumption Summary', icon: Calendar, desc: 'Month-by-month power volume and long-term seasonal baselines.' },
    { id: 'suspicious_activity', label: 'Suspicious Activity & Anomaly Log', icon: AlertTriangle, desc: 'Full log of flagged anomalies, expected baselines, and risk scores.' },
    { id: 'feeder_discrepancy', label: 'Feeder Energy Discrepancy', icon: GitBranch, desc: 'Feeder input energy vs transformer accounted output and loss %.' },
    { id: 'transformer_discrepancy', label: 'Transformer Energy Discrepancy', icon: Cpu, desc: 'Transformer input vs consumer metered sum and priority levels.' },
    { id: 'investigation_status', label: 'Investigation Status & Audit Trail', icon: FileText, desc: 'Field inspector actions, audit remarks, and status changes.' }
  ];

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await api.getReportData(reportType);
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType]);

  const activeOption = reportOptions.find(r => r.id === reportType);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-electric-400" />
            Audit Reports & Regulatory Exports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate and export structured consumption, loss, and investigation data in standard CSV format.
          </p>
        </div>

        {/* 1-Click CSV Download */}
        <a
          href={api.getReportCsvUrl(reportType)}
          download={`voltguard_${reportType}.csv`}
          className="flex items-center gap-2 px-4 py-2 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/30 transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Export Current Report as CSV
        </a>
      </div>

      {/* Report Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {reportOptions.map((opt) => {
          const Icon = opt.icon;
          const isSelected = reportType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setReportType(opt.id)}
              className={`p-3 rounded-xl border text-left transition ${
                isSelected
                  ? 'bg-electric-500/15 border-electric-500/50 text-white shadow-sm'
                  : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200 hover:border-navy-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-electric-400' : 'text-slate-400'}`} />
                <span className="font-semibold text-xs truncate">{opt.label}</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Report Table View */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-navy-800 gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Table className="w-4 h-4 text-electric-400" />
              {activeOption?.label}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{activeOption?.desc}</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Total Records: <strong className="text-white">{reportData?.total_records || 0}</strong>
          </span>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-navy-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950 text-slate-400 text-[10px] uppercase font-mono tracking-wider border-b border-navy-800">
              <tr>
                {reportData?.headers?.map((h) => (
                  <th key={h} className="py-2.5 px-3 whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={reportData?.headers?.length || 5} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Generating report data...
                  </td>
                </tr>
              ) : reportData?.data?.length === 0 ? (
                <tr>
                  <td colSpan={reportData?.headers?.length || 5} className="py-12 text-center text-slate-400">
                    No records found for this report criteria.
                  </td>
                </tr>
              ) : (
                reportData?.data?.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-navy-800/40">
                    {reportData.headers.map((h) => (
                      <td key={h} className="py-2 px-3 whitespace-nowrap">
                        {String(row[h] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
