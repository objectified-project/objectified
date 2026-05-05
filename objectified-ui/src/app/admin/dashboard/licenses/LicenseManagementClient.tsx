'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Award,
  Flag,
  Users,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Link,
  Eye,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getAllLicenses,
  getLicenseById,
  createLicense,
  updateLicense,
  deleteLicense,
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getAllUsersWithLicenses,
  assignLicenseToUser,
  removeUserLicense,
  setUserFeatureFlag,
  removeUserFeatureFlag,
} from '../../../../../lib/db/admin-helper';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeatureFlagRef {
  id: string;
  name: string;
  label: string;
  is_preview: boolean;
}

interface License {
  id: string;
  name: string;
  description: string | null;
  license_type: 'free' | 'paid' | 'sponsor';
  seats: Record<string, number>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  feature_flags: FeatureFlagRef[];
}

interface FeatureFlag {
  id: string;
  name: string;
  label: string;
  description: string | null;
  url_patterns: string[];
  is_preview: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface UserWithLicense {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  verified: boolean;
  license_id: string | null;
  license_name: string | null;
  license_type: string | null;
  seats: Record<string, number> | null;
  plan_code: string | null;
}

type Tab = 'licenses' | 'featureFlags' | 'assignments';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  free:    'bg-slate-700 text-slate-200',
  paid:    'bg-indigo-700 text-indigo-100',
  sponsor: 'bg-amber-700 text-amber-100',
};

function Badge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${TYPE_COLORS[type] ?? 'bg-gray-700 text-gray-200'}`}>
      {type}
    </span>
  );
}

function PreviewBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-900/40 text-amber-300 border border-amber-700/40">
      <Eye className="w-3 h-3" /> Preview
    </span>
  );
}

// ─── License form ────────────────────────────────────────────────────────────

interface LicenseFormProps {
  existing?: License | null;
  allFlags: FeatureFlag[];
  onSave: () => void;
  onCancel: () => void;
}

function LicenseForm({ existing, allFlags, onSave, onCancel }: LicenseFormProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [licenseType, setLicenseType] = useState<'free' | 'paid' | 'sponsor'>(existing?.license_type ?? 'free');
  const [seatsJson, setSeatsJson] = useState(
    existing ? JSON.stringify(existing.seats, null, 2) : '{\n  "max_tenants": 1,\n  "max_users_per_tenant": 5\n}'
  );
  const [seatsError, setSeatsError] = useState('');
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(
    new Set(existing?.feature_flags.map(f => f.id) ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleFlag = (id: string) => {
    setSelectedFlags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const validateSeats = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      setSeatsError('');
      return parsed;
    } catch {
      setSeatsError('Seats must be a valid JSON object (e.g. {"max_tenants": 1})');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seats = validateSeats(seatsJson);
    if (!seats) return;
    if (!name.trim()) { setError('Name is required'); return; }

    setSaving(true);
    setError('');
    try {
      let res: string;
      if (existing) {
        res = await updateLicense(existing.id, {
          name: name.trim(), description: description || null,
          licenseType, seats, featureFlagIds: [...selectedFlags],
        });
      } else {
        res = await createLicense(name.trim(), description || null, licenseType, seats, [...selectedFlags]);
      }
      const data = JSON.parse(res);
      if (!data.success) { setError(data.error); return; }
      onSave();
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="e.g. Paid"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type *</label>
          <select
            value={licenseType}
            onChange={e => setLicenseType(e.target.value as any)}
            className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="sponsor">Sponsor</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
          placeholder="Short description of this license tier"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Seats (JSON)</label>
        <p className="text-xs text-gray-500">Known keys: <code className="text-gray-400">max_tenants</code>, <code className="text-gray-400">max_users_per_tenant</code></p>
        <textarea
          value={seatsJson}
          onChange={e => { setSeatsJson(e.target.value); validateSeats(e.target.value); }}
          rows={4}
          className={`w-full bg-white dark:bg-gray-900 border rounded-lg px-3 py-2 text-green-300 font-mono text-sm focus:outline-none resize-none ${seatsError ? 'border-red-600' : 'border-slate-300 dark:border-gray-600 focus:border-indigo-500'}`}
        />
        {seatsError && <p className="text-xs text-red-400">{seatsError}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Included Feature Flags</label>
        {allFlags.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No feature flags defined yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {allFlags.map(ff => (
              <label
                key={ff.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedFlags.has(ff.id)
                    ? 'bg-indigo-900/30 border-indigo-600'
                    : 'bg-slate-50 dark:bg-gray-800/60 border-slate-300 dark:border-gray-700 hover:border-slate-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFlags.has(ff.id)}
                  onChange={() => toggleFlag(ff.id)}
                  className="mt-0.5 accent-indigo-500"
                />
                <span className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-900 dark:text-white font-medium flex items-center gap-1.5">
                    {ff.label}
                    {ff.is_preview && <PreviewBadge />}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{ff.name}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-400 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create License'}
        </button>
      </div>
    </form>
  );
}

// ─── Feature flag form ────────────────────────────────────────────────────────

interface FlagFormProps {
  existing?: FeatureFlag | null;
  onSave: () => void;
  onCancel: () => void;
}

function FlagForm({ existing, onSave, onCancel }: FlagFormProps) {
  const [name, setName] = useState(existing?.name ?? '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [urlsRaw, setUrlsRaw] = useState((existing?.url_patterns ?? []).join('\n'));
  const [isPreview, setIsPreview] = useState(existing?.is_preview ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !label.trim()) { setError('Name and Label are required'); return; }
    if (!/^[a-z0-9_]+$/.test(name.trim())) { setError('Name must be lowercase alphanumeric + underscores only'); return; }

    const urlPatterns = urlsRaw.split('\n').map(s => s.trim()).filter(Boolean);
    setSaving(true);
    setError('');
    try {
      let res: string;
      if (existing) {
        res = await updateFeatureFlag(existing.id, { label: label.trim(), description: description || null, urlPatterns, isPreview });
      } else {
        res = await createFeatureFlag(name.trim(), label.trim(), description || null, urlPatterns, isPreview);
      }
      const data = JSON.parse(res);
      if (!data.success) { setError(data.error); return; }
      onSave();
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machine Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!!existing}
            className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            placeholder="ai_assistant"
          />
          <p className="text-xs text-gray-500">Lowercase, underscores only. Cannot be changed after creation.</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Display Label *</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="AI Assistant"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Link className="w-3.5 h-3.5" /> URL Patterns (one per line)
        </label>
        <p className="text-xs text-gray-500">Paths that require this flag to be active. E.g. <code className="text-gray-400">/ade/studio</code> or <code className="text-gray-400">/api/ollama</code></p>
        <textarea
          value={urlsRaw}
          onChange={e => setUrlsRaw(e.target.value)}
          rows={4}
          className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-600 rounded-lg px-3 py-2 text-green-300 font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
          placeholder={`/ade/studio\n/api/ollama`}
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          className="text-indigo-400 hover:text-indigo-300"
        >
          {isPreview ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-gray-500" />}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">Mark as <strong>Preview</strong> (shows preview badge in UI)</span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-400 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Flag'}
        </button>
      </div>
    </form>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-gray-900 dark:text-white font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LicenseManagementClient() {
  const [activeTab, setActiveTab] = useState<Tab>('licenses');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [usersWithLicenses, setUsersWithLicenses] = useState<UserWithLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [licenseModal, setLicenseModal] = useState<'create' | 'edit' | null>(null);
  const [flagModal, setFlagModal] = useState<'create' | 'edit' | null>(null);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

  // Expanded licenses (to show feature flags)
  const [expandedLicenses, setExpandedLicenses] = useState<Set<string>>(new Set());

  // Assign dropdown
  const [assigningUser, setAssigningUser] = useState<UserWithLicense | null>(null);
  const [assignSearch, setAssignSearch] = useState('');

  // Flag override modal
  const [overrideUser, setOverrideUser] = useState<UserWithLicense | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [lr, ffr, ur] = await Promise.all([
        getAllLicenses(),
        getAllFeatureFlags(),
        getAllUsersWithLicenses(),
      ]);
      const ld = JSON.parse(lr); if (ld.success) setLicenses(ld.licenses);
      const fd = JSON.parse(ffr); if (fd.success) setFeatureFlags(fd.featureFlags);
      const ud = JSON.parse(ur); if (ud.success) setUsersWithLicenses(ud.users);
    } catch {
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── License tab ───────────────────────────────────────────────────────────

  const handleDeleteLicense = async (lic: License) => {
    if (!confirm(`Delete license "${lic.name}"? This cannot be undone.`)) return;
    const res = JSON.parse(await deleteLicense(lic.id));
    if (res.success) { showMessage('success', `License "${lic.name}" deleted`); loadAll(); }
    else showMessage('error', res.error);
  };

  // ── Feature flag tab ──────────────────────────────────────────────────────

  const handleDeleteFlag = async (ff: FeatureFlag) => {
    if (!confirm(`Delete feature flag "${ff.label}"? It will be removed from all licenses.`)) return;
    const res = JSON.parse(await deleteFeatureFlag(ff.id));
    if (res.success) { showMessage('success', `Feature flag "${ff.label}" deleted`); loadAll(); }
    else showMessage('error', res.error);
  };

  const handleToggleFlag = async (ff: FeatureFlag) => {
    const res = JSON.parse(await updateFeatureFlag(ff.id, { enabled: !ff.enabled }));
    if (res.success) loadAll();
    else showMessage('error', res.error);
  };

  // ── Assignments tab ───────────────────────────────────────────────────────

  const handleAssignLicense = async (userId: string, licenseId: string) => {
    const res = JSON.parse(await assignLicenseToUser(userId, licenseId));
    if (res.success) { showMessage('success', 'License assigned'); setAssigningUser(null); loadAll(); }
    else showMessage('error', res.error);
  };

  const handleRemoveLicense = async (user: UserWithLicense) => {
    if (!confirm(`Remove license from ${user.name}?`)) return;
    const res = JSON.parse(await removeUserLicense(user.id));
    if (res.success) { showMessage('success', 'License removed'); loadAll(); }
    else showMessage('error', res.error);
  };

  const filteredUsers = usersWithLicenses.filter(u =>
    !assignSearch || u.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(assignSearch.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'licenses',     label: 'Licenses',      icon: <Award className="w-4 h-4" />,  count: licenses.length },
    { id: 'featureFlags', label: 'Feature Flags',  icon: <Flag className="w-4 h-4" />,   count: featureFlags.length },
    { id: 'assignments',  label: 'Assignments',    icon: <Users className="w-4 h-4" />,  count: usersWithLicenses.filter(u => u.license_id).length },
  ];

  return (
    <>
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">License Management</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Define license plans, feature flags, and assign licenses to users</p>
          </div>
          <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-400 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Message banner */}
        {message && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${message.type === 'success' ? 'bg-green-900/20 border-green-700 text-green-400' : 'bg-red-900/20 border-red-700 text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-lg p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-gray-700/60'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-gray-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Licenses tab ─────────────────────────────────────────────────── */}
        {activeTab === 'licenses' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingLicense(null); setLicenseModal('create'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" /> New License
              </button>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
            ) : licenses.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No license plans defined.</div>
            ) : (
              <div className="space-y-2">
                {licenses.map(lic => (
                  <div key={lic.id} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="p-2 bg-indigo-600/20 rounded-lg">
                        <Award className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white font-semibold">{lic.name}</span>
                          <Badge type={lic.license_type} />
                          {!lic.enabled && (
                            <span className="text-xs text-gray-500 italic">disabled</span>
                          )}
                        </div>
                        {lic.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{lic.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {Object.entries(lic.seats).map(([k, v]) => (
                            <span key={k} className="text-xs text-gray-500">
                              <span className="text-gray-500 dark:text-gray-400 font-mono">{k.replace(/_/g, ' ')}</span>: <span className="text-gray-900 dark:text-white">{v}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedLicenses(prev => {
                            const next = new Set(prev);
                            if (next.has(lic.id)) next.delete(lic.id); else next.add(lic.id);
                            return next;
                          })}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                          title="Toggle feature flags"
                        >
                          {expandedLicenses.has(lic.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setEditingLicense(lic); setLicenseModal('edit'); }}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLicense(lic)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {expandedLicenses.has(lic.id) && (
                      <div className="border-t border-slate-200 dark:border-gray-700 px-5 py-3 bg-slate-50 dark:bg-gray-900/40">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Included Feature Flags</p>
                        {lic.feature_flags.length === 0 ? (
                          <p className="text-xs text-gray-600 italic">No feature flags assigned to this license.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {lic.feature_flags.map(ff => (
                              <span key={ff.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-200">
                                <Flag className="w-3 h-3 text-indigo-400" />
                                {ff.label}
                                {ff.is_preview && <PreviewBadge />}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-3 mb-1">Seats JSON</p>
                        <pre className="text-xs text-green-300 font-mono bg-gray-950 rounded-lg px-3 py-2 overflow-x-auto">
                          {JSON.stringify(lic.seats, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Feature Flags tab ─────────────────────────────────────────────── */}
        {activeTab === 'featureFlags' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingFlag(null); setFlagModal('create'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="w-4 h-4" /> New Feature Flag
              </button>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
            ) : featureFlags.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No feature flags defined.</div>
            ) : (
              <div className="space-y-2">
                {featureFlags.map(ff => (
                  <div key={ff.id} className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-5 py-4 flex items-start gap-4">
                    <div className="p-2 bg-purple-600/20 rounded-lg mt-0.5 shrink-0">
                      <Flag className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-900 dark:text-white font-semibold">{ff.label}</span>
                        <code className="text-xs text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded font-mono">{ff.name}</code>
                        {ff.is_preview && <PreviewBadge />}
                        {!ff.enabled && <span className="text-xs text-gray-500 italic">disabled</span>}
                      </div>
                      {ff.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{ff.description}</p>
                      )}
                      {ff.url_patterns.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ff.url_patterns.map((p, i) => (
                            <span key={i} className="flex items-center gap-1 text-xs text-green-300 bg-gray-900 border border-gray-700 px-2 py-0.5 rounded font-mono">
                              <Link className="w-2.5 h-2.5 text-gray-500" />{p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleFlag(ff)}
                        className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors ${ff.enabled ? 'text-green-400' : 'text-gray-600'}`}
                        title={ff.enabled ? 'Disable' : 'Enable'}
                      >
                        {ff.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => { setEditingFlag(ff); setFlagModal('edit'); }}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFlag(ff)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Assignments tab ───────────────────────────────────────────────── */}
        {activeTab === 'assignments' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search users…"
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
                className="flex-1 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-400 dark:placeholder-gray-500"
              />
              <span className="text-xs text-gray-500 shrink-0">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading…</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-gray-800/80 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Assigned License</th>
                      <th className="px-4 py-3 font-medium">Seats</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-700/60">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="bg-white dark:bg-gray-800/30 hover:bg-slate-50 dark:hover:bg-gray-800/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {user.license_name ? (
                            <div className="flex items-center gap-2">
                              <Badge type={user.license_type!} />
                              <span className="text-gray-900 dark:text-white">{user.license_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic text-xs">No license</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.seats ? (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {Object.entries(user.seats).map(([k, v]) => (
                                <span key={k} className="text-xs text-gray-500 dark:text-gray-400">
                                  {k.replace(/_/g, ' ')}: <span className="text-gray-900 dark:text-white">{v}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <div className="relative">
                              <button
                                onClick={() => setAssigningUser(assigningUser?.id === user.id ? null : user)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-700/40 text-indigo-300 hover:bg-indigo-700/60 border border-indigo-700/60 transition-colors"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Assign
                              </button>
                              {assigningUser?.id === user.id && (
                                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-600 rounded-xl shadow-2xl p-2 min-w-[200px]">
                                  {licenses.filter(l => l.enabled).map(lic => (
                                    <button
                                      key={lic.id}
                                      onClick={() => handleAssignLicense(user.id, lic.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                                    >
                                      <Badge type={lic.license_type} />
                                      {lic.name}
                                      {lic.id === user.license_id && <CheckCircle className="w-3.5 h-3.5 text-green-400 ml-auto" />}
                                    </button>
                                  ))}
                                  <div className="border-t border-slate-200 dark:border-gray-700 mt-1 pt-1">
                                    <button
                                      onClick={() => { setOverrideUser(user); setAssigningUser(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-gray-800 text-indigo-300 transition-colors"
                                    >
                                      <Flag className="w-3.5 h-3.5" /> Override Flags…
                                    </button>
                                  </div>
                                  {user.license_id && (
                                    <button
                                      onClick={() => { handleRemoveLicense(user); setAssigningUser(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-gray-800 text-red-400 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Remove License
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── License Modal ──────────────────────────────────────────────────── */}
      {licenseModal && (
        <Modal
          title={licenseModal === 'create' ? 'New License Plan' : `Edit — ${editingLicense?.name}`}
          onClose={() => setLicenseModal(null)}
        >
          <LicenseForm
            existing={licenseModal === 'edit' ? editingLicense : null}
            allFlags={featureFlags}
            onSave={() => { setLicenseModal(null); loadAll(); showMessage('success', 'License saved'); }}
            onCancel={() => setLicenseModal(null)}
          />
        </Modal>
      )}

      {/* ── Feature Flag Modal ─────────────────────────────────────────────── */}
      {flagModal && (
        <Modal
          title={flagModal === 'create' ? 'New Feature Flag' : `Edit — ${editingFlag?.label}`}
          onClose={() => setFlagModal(null)}
        >
          <FlagForm
            existing={flagModal === 'edit' ? editingFlag : null}
            onSave={() => { setFlagModal(null); loadAll(); showMessage('success', 'Feature flag saved'); }}
            onCancel={() => setFlagModal(null)}
          />
        </Modal>
      )}

      {/* ── Per-user flag override Modal ───────────────────────────────────── */}
      {overrideUser && (
        <OverrideFlagsModal
          user={overrideUser}
          allFlags={featureFlags}
          onClose={() => { setOverrideUser(null); loadAll(); }}
          showMessage={showMessage}
        />
      )}

      {/* Click-outside to close assign dropdown */}
      {assigningUser && (
        <div className="fixed inset-0 z-10" onClick={() => setAssigningUser(null)} />
      )}
    </>
  );
}

// ─── Per-user feature flag override modal ────────────────────────────────────

interface OverrideFlagsModalProps {
  user: UserWithLicense;
  allFlags: FeatureFlag[];
  onClose: () => void;
  showMessage: (type: 'success' | 'error', text: string) => void;
}

function OverrideFlagsModal({ user, allFlags, onClose, showMessage }: OverrideFlagsModalProps) {
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverrides = async () => {
      const { getUserLicense } = await import('../../../../../lib/db/admin-helper');
      const res = JSON.parse(await getUserLicense(user.id));
      if (res.success && res.license?.user_overrides) {
        const map = new Map<string, boolean>();
        for (const o of res.license.user_overrides) map.set(o.id, o.enabled);
        setOverrides(map);
      }
      setLoading(false);
    };
    fetchOverrides();
  }, [user.id]);

  const handleToggle = async (ff: FeatureFlag, enabled: boolean) => {
    setSaving(ff.id);
    try {
      const res = JSON.parse(await setUserFeatureFlag(user.id, ff.id, enabled));
      if (res.success) {
        setOverrides(prev => new Map(prev).set(ff.id, enabled));
        showMessage('success', `Override for "${ff.label}" ${enabled ? 'granted' : 'revoked'}`);
      } else {
        showMessage('error', res.error);
      }
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (ff: FeatureFlag) => {
    setSaving(ff.id);
    try {
      const res = JSON.parse(await removeUserFeatureFlag(user.id, ff.id));
      if (res.success) {
        setOverrides(prev => { const m = new Map(prev); m.delete(ff.id); return m; });
        showMessage('success', `Override for "${ff.label}" cleared (reverts to license default)`);
      } else {
        showMessage('error', res.error);
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal title={`Feature Flag Overrides — ${user.name}`} onClose={onClose}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Set explicit grant/revoke overrides for this user. Overrides take precedence over the license plan.
      </p>
      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading…</div>
      ) : (
        <div className="space-y-2">
          {allFlags.map(ff => {
            const override = overrides.has(ff.id) ? overrides.get(ff.id) : null;
            return (
              <div key={ff.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-gray-900/60 rounded-lg border border-slate-200 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white text-sm font-medium">{ff.label}</span>
                    {ff.is_preview && <PreviewBadge />}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{ff.name}</p>
                  {override === null && (
                    <p className="text-xs text-gray-600 italic mt-0.5">No override — using license default</p>
                  )}
                  {override === true && (
                    <p className="text-xs text-green-500 mt-0.5">✓ Explicitly granted</p>
                  )}
                  {override === false && (
                    <p className="text-xs text-red-400 mt-0.5">✗ Explicitly revoked</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(ff, true)}
                    disabled={saving === ff.id}
                    className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${override === true ? 'bg-green-700 text-green-100' : 'bg-slate-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-800 hover:text-green-200'} disabled:opacity-50`}
                  >
                    Grant
                  </button>
                  <button
                    onClick={() => handleToggle(ff, false)}
                    disabled={saving === ff.id}
                    className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${override === false ? 'bg-red-800 text-red-100' : 'bg-slate-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-900 hover:text-red-200'} disabled:opacity-50`}
                  >
                    Revoke
                  </button>
                  {override !== null && (
                    <button
                      onClick={() => handleClear(ff)}
                      disabled={saving === ff.id}
                      className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-slate-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      title="Clear override (revert to license default)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end pt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-400 transition-colors">
          Done
        </button>
      </div>
    </Modal>
  );
}
