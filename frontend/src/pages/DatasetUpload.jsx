import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  UploadCloud,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react';

export default function DatasetUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/uploads/history');
      if (res.ok) {
        const data = await res.json();
        setUploadHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadResult(null);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/preview', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to preview CSV');
      }

      const preview = await res.json();
      setPreviewData(preview);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/uploads/process', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload processing failed');
      }

      const result = await res.json();
      setUploadResult(result);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-electric-400" />
            CSV Dataset Ingestion & Schema Validation
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ingest smart meter datasets into SQLite with column verification, duplicate detection, and time-series alignment.
          </p>
        </div>

        <a
          href="/api/uploads/template"
          download="voltguard_sample_readings_template.csv"
          className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 rounded-lg text-xs font-semibold transition self-start sm:self-auto shadow-sm"
        >
          <Download className="w-4 h-4 text-electric-400" />
          Download Sample CSV Template
        </a>
      </div>

      {/* Upload Zone */}
      <div className="bg-navy-900 border-2 border-dashed border-navy-700/80 hover:border-electric-500/50 rounded-2xl p-8 text-center transition">
        <div className="w-12 h-12 rounded-2xl bg-electric-500/10 border border-electric-500/30 flex items-center justify-center text-electric-400 mx-auto mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-sm text-white mb-1">
          Select or Drop Smart Meter CSV File
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
          Supported fields: <span className="font-mono text-slate-300">timestamp, consumer_id, energy_kwh, voltage, current, power_factor, feeder_id, transformer_id</span>.
        </p>

        <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-lg shadow-electric-600/30 transition">
          <span>Choose CSV File</span>
          <input
            type="file"
            accept=".csv, .txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {selectedFile && (
          <p className="text-xs text-slate-300 mt-3 font-mono">
            Selected: <span className="text-electric-400 font-semibold">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CSV Preview & Supported Analyses */}
      {previewData && (
        <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-navy-800 gap-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-electric-400" />
                Dataset Validation Preview: {previewData.filename}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Rows Detected: <span className="font-mono text-slate-200 font-bold">{previewData.total_rows_detected}</span>
              </p>
            </div>

            <button
              onClick={handleProcessUpload}
              disabled={loading || previewData.missing_essential_columns?.length > 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Validating & Importing...' : 'Confirm & Ingest Readings into SQLite'}
            </button>
          </div>

          {/* Supported Analyses Badges */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-2">
              Analyses Enabled by Available Dataset Columns:
            </h4>
            <div className="flex flex-wrap gap-2">
              {previewData.supported_analyses?.map((ana, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {ana}
                </span>
              ))}
            </div>
          </div>

          {/* Missing Essential Columns Warning */}
          {previewData.missing_essential_columns?.length > 0 && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-xs">
              Missing mandatory columns required for analysis: {previewData.missing_essential_columns.join(', ')}
            </div>
          )}

          {/* Preview Table */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-2">First 10 Data Rows Preview:</h4>
            <div className="overflow-x-auto rounded-lg border border-navy-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950 text-slate-400 text-[10px] uppercase font-mono tracking-wider border-b border-navy-800">
                  <tr>
                    {previewData.columns?.map((col) => (
                      <th key={col} className="py-2.5 px-3 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-300 font-mono text-[11px]">
                  {previewData.preview?.map((row, i) => (
                    <tr key={i} className="hover:bg-navy-800/40">
                      {previewData.columns?.map((col) => (
                        <td key={col} className="py-2 px-3 whitespace-nowrap">{String(row[col] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload Result Banner */}
      {uploadResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-xs text-emerald-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            {uploadResult.message}
          </div>
          <p>
            Imported <span className="font-bold font-mono">{uploadResult.valid_rows_imported}</span> valid records into SQLite.
          </p>
          {uploadResult.validation_warnings?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-emerald-500/20 text-slate-300">
              <p className="font-semibold text-amber-400 mb-1">Sanitization Notes:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                {uploadResult.validation_warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Upload History Table */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-electric-400" />
          Ingested Datasets Audit Log
        </h3>
        <div className="overflow-x-auto rounded-lg border border-navy-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-2.5 px-3">Dataset Filename</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Total Rows</th>
                <th className="py-2.5 px-3">Valid Ingested</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Audit Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300">
              {uploadHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500">
                    No external uploads logged yet. Using simulated baseline data.
                  </td>
                </tr>
              ) : (
                uploadHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-navy-800/40">
                    <td className="py-2 px-3 font-semibold text-white font-mono">{item.filename}</td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{item.upload_timestamp}</td>
                    <td className="py-2 px-3 font-mono">{item.row_count}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400">{item.valid_rows}</td>
                    <td className="py-2 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-xs">{item.notes}</td>
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
