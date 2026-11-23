import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import RiskBadge from './RiskBadge';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { X, Zap, AlertTriangle, ShieldCheck, Clock, MapPin, Gauge } from 'lucide-react';

export default function ConsumerDetailModal({ consumerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!consumerId) return;
    setLoading(true);
    api.getConsumerDetail(consumerId)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [consumerId]);

  if (!consumerId) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-navy-900 border border-navy-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-navy-800 flex items-center justify-between bg-navy-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-electric-500/10 border border-electric-500/30 flex items-center justify-center text-electric-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">{data?.consumer?.name || consumerId}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-navy-800 text-slate-400 font-mono">
                  {consumerId}
                </span>
                {data && <RiskBadge level={data.alerts?.length > 0 ? data.alerts[0].risk_level : 'Low'} score={data.max_risk_score} />}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Meter ID: {data?.consumer?.meter_id || 'N/A'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-navy-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-8 h-8 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs">Loading consumer historical consumption...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs">
              Error loading consumer: {error}
            </div>
          )}

          {data && (
            <>
              {/* Consumer Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Category</span>
                  <p className="text-xs font-semibold text-white mt-1">{data.consumer.category}</p>
                </div>
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Sanctioned Load</span>
                  <p className="text-xs font-semibold text-electric-400 mt-1">{data.consumer.connected_load_capacity} kW</p>
                </div>
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Transformer ID</span>
                  <p className="text-xs font-semibold text-white mt-1">{data.consumer.transformer_id}</p>
                </div>
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Feeder ID</span>
                  <p className="text-xs font-semibold text-white mt-1">{data.consumer.feeder_id}</p>
                </div>
              </div>

              {/* Chart: Actual vs Expected Historical Baseline */}
              <div className="bg-navy-950/60 border border-navy-800 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Learned Baseline vs Actual Consumption (Past 72 Hours)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Individual expected baseline learned by time-of-day & day-of-week
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Unit: kWh</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.readings_history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        stroke="#64748B"
                        fontSize={10}
                        tickFormatter={(val) => val ? val.slice(11, 16) : ''}
                      />
                      <YAxis stroke="#64748B" fontSize={10} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0B1329', borderColor: '#1E293B', borderRadius: '8px', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line
                        type="monotone"
                        dataKey="energy_kwh"
                        name="Actual Consumption (kWh)"
                        stroke="#38BDF8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expected_kwh"
                        name="Expected Baseline (kWh)"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Active Alerts for this consumer */}
              {data.alerts && data.alerts.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Active Alerts & Anomaly Explanations ({data.alerts.length})
                  </h4>
                  <div className="space-y-2 mt-2">
                    {data.alerts.slice(0, 3).map((alt) => (
                      <div key={alt.id} className="bg-navy-900 border border-navy-800 p-3 rounded-lg text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{alt.activity_type}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{alt.timestamp}</span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{alt.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Readings Table */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                  Recent Readings & Diagnostic Metrics
                </h4>
                <div className="overflow-x-auto rounded-xl border border-navy-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-navy-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actual (kWh)</th>
                        <th className="py-2.5 px-3">Baseline</th>
                        <th className="py-2.5 px-3">Deviation %</th>
                        <th className="py-2.5 px-3">Power Factor</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-800 text-slate-300">
                      {data.readings_history.slice(-10).reverse().map((r, i) => (
                        <tr key={i} className="hover:bg-navy-800/40">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{r.timestamp}</td>
                          <td className="py-2 px-3 font-semibold text-white">{r.energy_kwh}</td>
                          <td className="py-2 px-3 text-slate-400">{r.expected_kwh || '—'}</td>
                          <td className={`py-2 px-3 font-semibold ${
                            r.deviation_pct > 50 ? 'text-red-400' : r.deviation_pct < -40 ? 'text-amber-400' : 'text-slate-300'
                          }`}>
                            {r.deviation_pct ? `${r.deviation_pct > 0 ? '+' : ''}${r.deviation_pct}%` : '0%'}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{r.power_factor || '0.92'}</td>
                          <td className="py-2 px-3">
                            {r.is_anomaly ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                Abnormal
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
