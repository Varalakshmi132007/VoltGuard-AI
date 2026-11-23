import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  GitBranch,
  Cpu,
  UploadCloud,
  ScanSearch,
  ShieldAlert,
  AlertTriangle,
  BarChart3,
  FileText,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ currentPage, onNavigate, isCollapsed, onToggleCollapse, alertCount = 0 }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'consumers', label: 'Consumer Management', icon: Users },
    { id: 'monitoring', label: 'Energy Monitoring', icon: Activity },
    { id: 'feeders', label: 'Feeder Monitoring', icon: GitBranch },
    { id: 'transformers', label: 'Transformer Monitoring', icon: Cpu },
    { id: 'uploads', label: 'Dataset Upload', icon: UploadCloud },
    { id: 'detection', label: 'AI Anomaly Detection', icon: ScanSearch },
    { id: 'theft', label: 'Possible Theft Detection', icon: ShieldAlert, badge: 'AI' },
    { id: 'alerts', label: 'Alerts & Investigations', icon: AlertTriangle, count: alertCount },
    { id: 'analytics', label: 'ML Performance', icon: BarChart3 },
    { id: 'reports', label: 'Reports & Export', icon: FileText },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-navy-900 border-r border-navy-700/60 z-30 transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-electric-600 to-electric-400 flex items-center justify-center shadow-lg shadow-electric-500/20 shrink-0">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-base tracking-wide text-white flex items-center gap-1.5">
                VoltGuard <span className="text-electric-400 font-extrabold text-xs px-1.5 py-0.5 rounded bg-electric-500/15 border border-electric-500/30">AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">Smart Power Sentinel</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800 transition"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-electric-500/15 text-electric-400 border border-electric-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-electric-400' : 'group-hover:text-slate-200'}`} />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
              {!isCollapsed && item.count > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                  {item.count}
                </span>
              )}
              {!isCollapsed && item.badge && (
                <span className="bg-electric-500/20 text-electric-300 text-[9px] font-bold px-1 py-0.2 rounded shrink-0 border border-electric-500/40">
                  {item.badge}
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-navy-800 text-white text-xs rounded shadow-lg border border-navy-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3 border-t border-navy-800">
        {!isCollapsed ? (
          <div className="bg-navy-950/70 rounded-lg p-2.5 border border-navy-800 text-xs">
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <span className="text-[11px] font-medium text-slate-400">Grid Status</span>
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Isolation Forest Active</p>
          </div>
        ) : (
          <div className="flex justify-center py-2" title="Grid Status: Online">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
