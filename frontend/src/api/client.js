// Centralized API client for VoltGuard AI
const BASE_URL = '/api';

export async function fetchJson(endpoint, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Dashboard
  getDashboardSummary: () => fetchJson('/dashboard/summary'),
  getDashboardCharts: () => fetchJson('/dashboard/charts'),

  // Consumers
  getConsumers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/consumers/${qs ? '?' + qs : ''}`);
  },
  getConsumerDetail: (id) => fetchJson(`/consumers/${id}`),
  createConsumer: (data) => fetchJson('/consumers/', { method: 'POST', body: JSON.stringify(data) }),
  updateConsumer: (id, data) => fetchJson(`/consumers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteConsumer: (id) => fetchJson(`/consumers/${id}`, { method: 'DELETE' }),

  // Monitoring
  getFinancialExposure: () => fetchJson('/monitoring/financial-exposure'),
  getNetworkOverview: () => fetchJson('/monitoring/network-overview'),

  // Feeders & Transformers
  getFeeders: () => fetchJson('/feeders/'),
  getFeederDetail: (id) => fetchJson(`/feeders/${id}`),
  getTransformers: () => fetchJson('/transformers/'),
  getTransformerDetail: (id) => fetchJson(`/transformers/${id}`),

  // Anomaly & Detection
  getDetections: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/detection/detections${qs ? '?' + qs : ''}`);
  },
  runAnomalyDetection: (contamination = 0.08) =>
    fetchJson(`/detection/run-anomaly-detection?contamination=${contamination}`, { method: 'POST' }),
  getInspectionPriorities: () => fetchJson('/detection/inspection-priorities'),

  // Alerts
  getAlerts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/alerts/${qs ? '?' + qs : ''}`);
  },
  getAlertDetail: (id) => fetchJson(`/alerts/${id}`),
  updateAlertStatus: (id, data) =>
    fetchJson(`/alerts/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Analytics & ML Performance
  getModelPerformance: () => fetchJson('/analytics/model-performance'),
  reEvaluateModels: () => fetchJson('/analytics/re-evaluate-models', { method: 'POST' }),

  // Reports
  getReportData: (reportType) => fetchJson(`/reports/data?report_type=${reportType}`),
  getReportCsvUrl: (reportType) => `${BASE_URL}/reports/export-csv?report_type=${reportType}`,

  // Simulation
  advanceSimulation: (hours = 1) =>
    fetchJson('/simulation/step', { method: 'POST', body: JSON.stringify({ hours_to_advance: hours }) }),
  injectSuspicious: (scenario = 'Sudden_Drop_Meter_Bypass', consumerId = null) =>
    fetchJson('/simulation/inject-suspicious', { method: 'POST', body: JSON.stringify({ scenario, consumer_id: consumerId }) }),

  // Settings
  getSettings: () => fetchJson('/settings/'),
  updateSetting: (key, value) =>
    fetchJson('/settings/update', { method: 'POST', body: JSON.stringify({ key, value }) }),
  resetSampleData: () => fetchJson('/settings/reset-sample-data', { method: 'POST' })
};
