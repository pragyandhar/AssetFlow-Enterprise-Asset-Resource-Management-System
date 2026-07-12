import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Edit2, Box, Loader2, X, Filter, FileText } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

const STATUSES = ['Available', 'Allocated', 'Reserved', 'UnderMaintenance', 'Lost', 'Retired', 'Disposed'];
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];

function AssetForm({ categories, departments, onSave, onClose, initial }) {
  const [form, setForm] = useState(initial || {
    name: '', category_id: '', serial_number: '', acquisition_date: '',
    acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
    department_id: '', notes: '', photo_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.response?.data?.error || 'Error saving'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save}>
      {error && <div className="auth-error mb-4">{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label required">Asset Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label required">Category</label>
            <select className="form-control" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Serial Number</label>
            <input className="form-control" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Condition</label>
            <select className="form-control" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Acquisition Date</label>
            <input type="date" className="form-control" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Acquisition Cost ($)</label>
            <input type="number" step="0.01" className="form-control" value={form.acquisition_cost} onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-control" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Building A, Floor 2" />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-control" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <input type="checkbox" id="bookable" checked={form.is_bookable} onChange={e => setForm(f => ({ ...f, is_bookable: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="bookable" style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            <strong>Shared/Bookable Resource</strong> — employees can book this asset by time slot
          </label>
        </div>
        <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : initial ? 'Update Asset' : 'Register Asset'}</button>
        </div>
      </div>
    </form>
  );
}

function AssetDetailModal({ asset, onClose, onEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');

  useEffect(() => {
    api.get(`/assets/${asset.id}`).then(r => { setDetail(r.data); setLoading(false); });
  }, [asset.id]);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  const { asset: a, allocations, maintenance } = detail;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="asset-tag">{a.asset_tag}</span>
            <StatusBadge status={a.status} />
            <span className="badge badge-muted">{a.condition}</span>
          </div>
          <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{a.name}</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{a.category_name} · {a.location || 'No location'}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); onEdit(a); }}><Edit2 size={14} /> Edit</button>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {['info', 'allocations', 'maintenance'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="form-grid">
          {[
            ['Asset Tag', a.asset_tag], ['Serial Number', a.serial_number || '—'],
            ['Category', a.category_name], ['Department', a.department_name || '—'],
            ['Location', a.location || '—'], ['Condition', a.condition],
            ['Acquisition Date', a.acquisition_date || '—'], ['Cost', a.acquisition_cost ? `$${Number(a.acquisition_cost).toLocaleString()}` : '—'],
            ['Bookable', a.is_bookable ? 'Yes' : 'No'], ['Status', a.status],
          ].map(([label, val]) => (
            <div key={label} style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{val}</div>
            </div>
          ))}
          {a.notes && <div style={{ gridColumn: 'span 2', padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Notes</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{a.notes}</div>
          </div>}
        </div>
      )}

      {tab === 'allocations' && (
        <div>
          {allocations.length === 0 ? <div className="empty-state"><Box size={40} className="empty-state-icon" /><div className="empty-state-title">No allocation history</div></div> : (
            allocations.map(al => (
              <div key={al.id} style={{ padding: '0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{al.allocated_to_name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Allocated by {al.allocated_by_name} · {al.department_name || '—'}</div>
                    {al.return_notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Return notes: {al.return_notes}</div>}
                  </div>
                  <StatusBadge status={al.status} />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>From: {format(parseISO(al.created_at), 'MMM d, yyyy')}</span>
                  {al.actual_return_date && <span>Returned: {format(parseISO(al.actual_return_date), 'MMM d, yyyy')}</span>}
                  {al.expected_return_date && <span>Expected: {al.expected_return_date}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div>
          {maintenance.length === 0 ? <div className="empty-state"><div className="empty-state-title">No maintenance history</div></div> : (
            maintenance.map(m => (
              <div key={m.id} style={{ padding: '0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.description}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>By {m.requested_by_name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <StatusBadge status={m.priority} />
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AssetDirectory() {
  const { canManageAssets } = useAuth();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [bookableFilter, setBookableFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    if (bookableFilter) params.is_bookable = bookableFilter;
    const [aRes, cRes, dRes] = await Promise.all([
      api.get('/assets', { params }),
      api.get('/categories'),
      api.get('/departments'),
    ]);
    setAssets(aRes.data.assets);
    setCategories(cRes.data.categories);
    setDepartments(dRes.data.departments);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, statusFilter, categoryFilter, bookableFilter]);

  const handleCreate = async (form) => { await api.post('/assets', form); load(); };
  const handleUpdate = async (form) => { await api.put(`/assets/${showEdit.id}`, form); setShowEdit(null); load(); };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Asset Directory</h1>
          <p className="page-subtitle">Register and track all organizational assets</p>
        </div>
        {canManageAssets && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Register Asset</button>
        )}
      </div>

      <div className="filter-bar">
        <div className="table-search">
          <Search size={16} />
          <input placeholder="Search name, tag, serial, location..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="filter-select" value={bookableFilter} onChange={e => setBookableFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="true">Bookable Only</option>
          <option value="false">Non-Bookable</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-responsive">
          {loading ? (
            <div className="loading-container"><div className="loading-spinner" /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Condition</th>
                  <th>Current Holder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(asset => (
                  <tr key={asset.id}>
                    <td>
                      <div>
                        <span className="asset-tag" style={{ display: 'inline-block', marginBottom: '0.25rem' }}>{asset.asset_tag}</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</div>
                        {asset.serial_number && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SN: {asset.serial_number}</div>}
                      </div>
                    </td>
                    <td>{asset.category_name}</td>
                    <td>{asset.location || '—'}</td>
                    <td><StatusBadge status={asset.status} /></td>
                    <td><StatusBadge status={asset.condition} dot={false} /></td>
                    <td>{asset.current_holder || '—'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowDetail(asset)} title="View Details"><Eye size={14} /></button>
                        {canManageAssets && (
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowEdit(asset)} title="Edit"><Edit2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><Box size={40} className="empty-state-icon" /><div className="empty-state-title">No assets found</div><div className="empty-state-desc">Try adjusting your search or filters</div></div></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Register New Asset" size="lg">
        <AssetForm categories={categories} departments={departments} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Asset" size="lg">
        {showEdit && <AssetForm categories={categories} departments={departments} onSave={handleUpdate} onClose={() => setShowEdit(null)} initial={showEdit} />}
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Asset Details" size="lg">
        {showDetail && <AssetDetailModal asset={showDetail} onClose={() => setShowDetail(null)} onEdit={(a) => { setShowEdit(a); }} />}
      </Modal>
    </div>
  );
}
