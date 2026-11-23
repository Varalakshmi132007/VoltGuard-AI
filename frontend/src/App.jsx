import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Consumers from './pages/Consumers';
import EnergyMonitoring from './pages/EnergyMonitoring';
import FeederMonitoring from './pages/FeederMonitoring';
import TransformerMonitoring from './pages/TransformerMonitoring';
import DatasetUpload from './pages/DatasetUpload';
import AnomalyDetection from './pages/AnomalyDetection';
import PossibleTheftDetection from './pages/PossibleTheftDetection';
import AlertsInvestigations from './pages/AlertsInvestigations';
import MLPerformance from './pages/MLPerformance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { api } from './api/client';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  const loadAlertsSummary = async () => {
    try {
      const alerts = await api.getAlerts({ status: 'Pending Investigation' });
      setActiveAlertsCount(alerts.length);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAlertsSummary();
  }, [refreshKey]);

  const handleGlobalRefresh = () => {
    setRefreshKey(prev => prev + 1);
    loadAlertsSummary();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} refreshKey={refreshKey} />;
      case 'consumers':
        return <Consumers />;
      case 'monitoring':
        return <EnergyMonitoring onNavigate={setCurrentPage} />;
      case 'feeders':
        return <FeederMonitoring />;
      case 'transformers':
        return <TransformerMonitoring onNavigate={setCurrentPage} />;
      case 'uploads':
        return <DatasetUpload />;
      case 'detection':
        return <AnomalyDetection />;
      case 'theft':
        return <PossibleTheftDetection onNavigate={setCurrentPage} />;
      case 'alerts':
        return <AlertsInvestigations onAlertUpdated={handleGlobalRefresh} />;
      case 'analytics':
        return <MLPerformance />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings onDataReset={handleGlobalRefresh} />;
      default:
        return <Dashboard onNavigate={setCurrentPage} refreshKey={refreshKey} />;
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        alertCount={activeAlertsCount}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Topbar
          onRefreshData={handleGlobalRefresh}
          activeAlertsCount={activeAlertsCount}
          onNavigate={setCurrentPage}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {renderPage()}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-navy-800/80 px-6 py-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong>VoltGuard AI</strong> — Intelligent Electricity Monitoring, Anomaly Detection & Unauthorized Usage System
          </p>
          <p className="text-[11px] font-mono">
            SQLite • Scikit-Learn (Isolation Forest & Random Forest) • FastAPI • React + Vite
          </p>
        </footer>
      </div>
    </div>
  );
}
