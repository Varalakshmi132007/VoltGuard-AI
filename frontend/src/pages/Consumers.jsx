import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import ConsumerDetailModal from '../components/ConsumerDetailModal';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  AlertCircle,
  Building2,
  Home,
  Factory
} from 'lucide-react';

export default function Consumers() {
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [feederId, setFeederId] = useState('');
  const [transformerId, setTransformerId] = useState('');

  // Modals
  const [selectedConsumerId, setSelectedConsumerId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editConsumer, setEditConsumer] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    consumer_id: '',
    name: '',
    meter_id: '',
    category: 'Residential',
    location: '',
    connected_load_capacity: 4.0,
    feeder_id: 'FDR-NORTH-01',
    transformer_id: 'TR-102'
  });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const loadConsumers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (feederId) params.feeder_id = feederId;
      if (transformerId) params.transformer_id = transformerId;

      const data = await api.getConsumers(params);
      setConsumers(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadConsumers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, category, feederId, transformerId]);

  const handleCreateConsumer = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.createConsumer({
        ...formData,
        connected_load_capacity: parseFloat(formData.connected_load_capacity)
      });
      setFormSuccess('Consumer created successfully!');
      setTimeout(() => {
        setFormSuccess(null);
        setShowAddModal(false);
        loadConsumers();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleUpdateConsumer = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.updateConsumer(editConsumer.consumer_id, {
        name: formData.name,
        category: formData.category,
        location: formData.location,
        connected_load_capacity: parseFloat(formData.connected_load_capacity),
        feeder_id: formData.feeder_id,
        transformer_id: formData.transformer_id
      });
      setFormSuccess('Consumer updated successfully!');
      setTimeout(() => {
        setFormSuccess(null);
        setEditConsumer(null);
        loadConsumers();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteConsumer = async (id) => {
    if (!window.confirm(`Are you sure you want to delete consumer '${id}'? This will remove all associated readings and alerts.`)) {
      return;
    }
    try {
      await api.deleteConsumer(id);
      loadConsumers();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const openEditModal = (c) => {
    setEditConsumer(c);
    setFormData({
      consumer_id: c.consumer_id,
      name: c.name,
      meter_id: c.meter_id,
      category: c.category,
      location: c.location,
      connected_load_capacity: c.connected_load_capacity,
      feeder_id: c.feeder_id,
      transformer_id: c.transformer_id
    });
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-electric-400" />
            Consumer Registry & Historical Profiles
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage individual smart meters, sanctioned connected loads, and network topology associations.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              consumer_id: `CON-RES-${Math.floor(100 + Math.random() * 900)}`,
              name: '',
              meter_id: `MTR-RES-${Math.floor(100 + Math.random() * 900)}`,
              category: 'Residential',
              location: 'Sector 7, Block B',
              connected_load_capacity: 4.0,
              feeder_id: 'FDR-NORTH-01',
              transformer_id: 'TR-102'
            });
            setFormError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Consumer
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Consumer ID, Name, Meter ID, or Location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-navy-950 border border-navy-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-electric-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
          >
            <option value="">All Categories</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Industrial">Industrial</option>
          </select>

          {/* Feeder Filter */}
          <select
            value={feederId}
            onChange={(e) => setFeederId(e.target.value)}
            className="bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
          >
            <option value="">All Feeders</option>
            <option value="FDR-NORTH-01">FDR-NORTH-01</option>
            <option value="FDR-CENTRAL-02">FDR-CENTRAL-02</option>
            <option value="FDR-WEST-03">FDR-WEST-03</option>
          </select>

          {/* Transformer Filter */}
          <select
            value={transformerId}
            onChange={(e) => setTransformerId(e.target.value)}
            className="bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-electric-500"
          >
            <option value="">All Transformers</option>
            <option value="TR-101">TR-101 (Industrial)</option>
            <option value="TR-102">TR-102 (Suspicious Hub)</option>
            <option value="TR-201">TR-201 (Commercial Tech)</option>
            <option value="TR-202">TR-202 (Mall Complex)</option>
            <option value="TR-301">TR-301 (Residential)</option>
            <option value="TR-302">TR-302 (Hilltop)</option>
          </select>
        </div>
      </div>

      {/* Consumer Table */}
      <div className="bg-navy-900 border border-navy-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 text-[11px] uppercase tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Consumer</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Sanctioned Load</th>
                <th className="py-3 px-4">Topology</th>
                <th className="py-3 px-4">Total Consumed</th>
                <th className="py-3 px-4">Risk Profile</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-electric-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching consumers...
                  </td>
                </tr>
              ) : consumers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No consumers found matching filters.
                  </td>
                </tr>
              ) : (
                consumers.map((c) => (
                  <tr key={c.consumer_id} className="hover:bg-navy-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-navy-950 flex items-center justify-center text-slate-400 border border-navy-800">
                          {c.category === 'Residential' ? <Home className="w-4 h-4 text-sky-400" /> : c.category === 'Commercial' ? <Building2 className="w-4 h-4 text-indigo-400" /> : <Factory className="w-4 h-4 text-amber-400" />}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{c.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">{c.consumer_id} • Meter: {c.meter_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-navy-950 text-slate-300 border border-navy-800">
                        {c.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-electric-400">
                      {c.connected_load_capacity} kW
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      <p className="font-mono text-slate-300">{c.transformer_id}</p>
                      <p>{c.feeder_id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {c.total_consumption_kwh?.toLocaleString()} kWh
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge level={c.risk_level || 'Low'} />
                      {c.suspicious_count > 0 && (
                        <span className="ml-1.5 text-[10px] text-red-400 font-bold">
                          ({c.suspicious_count} alerts)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedConsumerId(c.consumer_id)}
                          className="p-1.5 text-slate-400 hover:text-electric-400 rounded hover:bg-navy-800 transition"
                          title="View Historical Load Baseline & Diagnostic Graph"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-navy-800 transition"
                          title="Edit Consumer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConsumer(c.consumer_id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-navy-800 transition"
                          title="Delete Consumer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Consumer Modal */}
      {(showAddModal || editConsumer) && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="font-bold text-base text-white mb-1">
              {editConsumer ? `Edit Consumer ${editConsumer.consumer_id}` : 'Register New Consumer'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter electrical meter details, sanctioned capacity, and grid attachment.
            </p>

            {formError && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-xs mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={editConsumer ? handleUpdateConsumer : handleCreateConsumer} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Consumer ID</label>
                  <input
                    type="text"
                    required
                    disabled={!!editConsumer}
                    value={formData.consumer_id}
                    onChange={(e) => setFormData({ ...formData, consumer_id: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Meter Serial Number</label>
                  <input
                    type="text"
                    required
                    disabled={!!editConsumer}
                    value={formData.meter_id}
                    onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Consumer / Business Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  placeholder="e.g. Ramesh Kumar or Metro Textile"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={formData.connected_load_capacity}
                    onChange={(e) => setFormData({ ...formData, connected_load_capacity: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Premises Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  placeholder="e.g. Flat 301, Sector 9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Associated Feeder</label>
                  <select
                    value={formData.feeder_id}
                    onChange={(e) => setFormData({ ...formData, feeder_id: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="FDR-NORTH-01">FDR-NORTH-01</option>
                    <option value="FDR-CENTRAL-02">FDR-CENTRAL-02</option>
                    <option value="FDR-WEST-03">FDR-WEST-03</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Connected Transformer</label>
                  <select
                    value={formData.transformer_id}
                    onChange={(e) => setFormData({ ...formData, transformer_id: e.target.value })}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="TR-101">TR-101</option>
                    <option value="TR-102">TR-102</option>
                    <option value="TR-201">TR-201</option>
                    <option value="TR-202">TR-202</option>
                    <option value="TR-301">TR-301</option>
                    <option value="TR-302">TR-302</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-navy-800 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditConsumer(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-electric-600 hover:bg-electric-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-electric-600/30 transition"
                >
                  {editConsumer ? 'Save Changes' : 'Create Consumer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Consumer Detail & History Modal */}
      {selectedConsumerId && (
        <ConsumerDetailModal
          consumerId={selectedConsumerId}
          onClose={() => setSelectedConsumerId(null)}
        />
      )}
    </div>
  );
}
