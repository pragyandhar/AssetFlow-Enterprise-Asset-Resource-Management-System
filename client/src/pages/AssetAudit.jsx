import { useState, useEffect } from 'react';
import { Plus, ClipboardList, Lock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

export default function AssetAudit() {
  const { user, canManageAssets, isAdmin } = useAuth();
  const [audits, setAudits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [auditDetail, setAuditDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [markItem, setMarkItem] = useState(null);
  const [markForm, setMarkForm] = useState({ status: 'Verified', notes: '' });

  const [form, setForm] = useState({
    name: '', scope_type: 'All', scope_value: '', start_date: '', end_date: '', auditor_ids: [], notes: ''
  });

  const load = async () => {
    setLoading(true);
    const [aRes, eRes, dRes] = await Promise.all([api.get('/audits'), api.get('/employees?status=Active'), api.get('/departments')]);
    setAudits(aRes.data.audits);
    setEmployees(eRes.data.employees);
    setDepartments(dRes.data.departments);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadDetail = async (audit) => {
    setSelectedAudit(audit);
    const { data } = await api.get(`/audits/${audit.id}`);
    setAuditDetail(data);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/audits', { ...form, auditor_ids: form.auditor_ids.map(Number) });
      setShowCreate(false);
      setForm({ name: '', scope_type: 'All', scope_value: '', start_date: '', end_date: '', auditor_ids: [], notes: '' });
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error creating audit'); }
    finally { setSaving(false); }
  };

  const handleMarkItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/audits/${selectedAudit.id}/items/${markItem.id}`, markForm);
      setMarkItem(null);
      await loadDetail(selectedAudit);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleClose = async () => {
    if (!confirm(`Close audit "${selectedAudit.name}"? This will lock the cycle and update asset statuses.`)) return;
    try {
      const { data } = await api.post(`/audits/${selectedAudit.id}/close`);
      alert(`Audit closed. Missing: ${data.missing_count}, Damaged: ${data.damaged_count}`);
      load();
      setSelectedAudit(null);
      setAuditDetail(null);
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const toggleAuditor = (id) => {
    setForm(f => ({
      ...f,
      auditor_ids: f.auditor_ids.includes(id) ? f.auditor_ids.filter(a => a !== id) : [...f.auditor_ids, id]
    }));
  };

  const STATUS_ICONS = { Verified: '✅', Missing: '❌', Damaged: '⚠️', Pending: '⏳' };
  const STATUS_COLORS = {
    Verified: 'var(--success)', Missing: 'var(--danger)', Damaged: 'var(--warning)', Pending: 'var(--text-muted)'
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Asset Audits</h1>
          <p className="page-subtitle">Run structured verification cycles and auto-generate discrepancy reports</p>
        </div>
        {canManageAssets && (
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}>
            <Plus size={16} /> Create Audit Cycle
          </button>
        )}
      </div>

      {selectedAudit ? (
        // Audit Detail View
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedAudit(null); setAuditDetail(null); }} style={{ marginBottom: '1rem' }}>
            ← Back to Audits
          </button>

          <div className="card mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <h2>{auditDetail?.audit?.name}</h2>
                  <StatusBadge status={auditDetail?.audit?.status} />
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Scope: {auditDetail?.audit?.scope_type} {auditDetail?.audit?.scope_value ? `(${auditDetail.audit.scope_value})` : ''}
                  · {auditDetail?.audit?.start_date} to {auditDetail?.audit?.end_date}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Created by {auditDetail?.audit?.created_by_name}
                </div>
              </div>
              {canManageAssets && auditDetail?.audit?.status !== 'Closed' && (
                <button className="btn btn-danger" onClick={handleClose}>
                  <Lock size={16} /> Close Audit
                </button>
              )}
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {[
                { label: 'Total', val: auditDetail?.audit?.total_items || 0, color: 'var(--text-primary)' },
                { label: 'Verified', val: auditDetail?.audit?.verified_count || 0, color: 'var(--success)' },
                { label: 'Missing', val: auditDetail?.audit?.missing_count || 0, color: 'var(--danger)' },
                { label: 'Damaged', val: auditDetail?.audit?.damaged_count || 0, color: 'var(--warning)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Discrepancy Alert */}
            {((auditDetail?.audit?.missing_count || 0) + (auditDetail?.audit?.damaged_count || 0)) > 0 && (
              <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                <AlertTriangle size={16} className="alert-icon" />
                <div>
                  <div className="alert-title">Discrepancies Found</div>
                  <div className="alert-message">{auditDetail?.audit?.missing_count} missing, {auditDetail?.audit?.damaged_count} damaged assets require attention.</div>
                </div>
              </div>
            )}
          </div>

          {/* Auditors */}
          {auditDetail?.assignments?.length > 0 && (
            <div className="card mb-4">
              <div className="card-title mb-4">Assigned Auditors</div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {auditDetail.assignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, color: 'white' }}>
                      {a.auditor_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{a.auditor_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.auditor_email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Items */}
          <div className="table-container">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Audit Checklist ({auditDetail?.items?.length || 0} items)</div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr><th>Asset</th><th>Category</th><th>Location</th><th>Condition</th><th>Status</th><th>Notes</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {auditDetail?.items?.map(item => (
                    <tr key={item.id}>
                      <td><span className="asset-tag">{item.asset_tag}</span><div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{item.asset_name}</div></td>
                      <td>{item.category_name}</td>
                      <td>{item.location || '—'}</td>
                      <td><StatusBadge status={item.condition} dot={false} /></td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: STATUS_COLORS[item.status], fontWeight: 500 }}>
                          {STATUS_ICONS[item.status]} {item.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>{item.notes || '—'}</td>
                      <td>
                        {auditDetail?.audit?.status !== 'Closed' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setMarkItem(item); setMarkForm({ status: 'Verified', notes: '' }); }}>
                            Mark
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // Audit List
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? <div className="loading-container"><div className="loading-spinner" /></div> : audits.length === 0 ? (
            <div className="empty-state"><ClipboardList size={48} className="empty-state-icon" /><div className="empty-state-title">No audit cycles yet</div><div className="empty-state-desc">Create an audit cycle to start verifying assets</div></div>
          ) : audits.map(audit => (
            <div key={audit.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => loadDetail(audit)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3>{audit.name}</h3>
                    <StatusBadge status={audit.status} />
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Scope: {audit.scope_type} · {audit.start_date} to {audit.end_date} · By {audit.created_by_name}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', textAlign: 'center' }}>
                  <div><div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{audit.total_items}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div></div>
                  <div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--success)' }}>{audit.verified_count}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified</div></div>
                  <div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--danger)' }}>{audit.missing_count}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Missing</div></div>
                  <div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--warning)' }}>{audit.damaged_count}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Damaged</div></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Audit Cycle" size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Create Audit Cycle'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label required">Audit Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q2 2025 IT Asset Audit" required />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required">Scope Type</label>
              <select className="form-control" value={form.scope_type} onChange={e => setForm(f => ({ ...f, scope_type: e.target.value, scope_value: '' }))}>
                <option value="All">All Assets</option>
                <option value="Department">By Department</option>
                <option value="Location">By Location</option>
              </select>
            </div>
            {form.scope_type === 'Department' && (
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-control" value={form.scope_value} onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {form.scope_type === 'Location' && (
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-control" value={form.scope_value} onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))} placeholder="e.g. Building A" />
              </div>
            )}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required">Start Date</label>
              <input type="date" className="form-control" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label required">End Date</label>
              <input type="date" className="form-control" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Assign Auditors</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              {employees.map(e => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', background: form.auditor_ids.includes(e.id) ? 'rgba(79,142,247,0.15)' : 'var(--bg-input)', border: `1px solid ${form.auditor_ids.includes(e.id) ? 'var(--border-accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={form.auditor_ids.includes(e.id)} onChange={() => toggleAuditor(e.id)} style={{ width: 14, height: 14 }} />
                  {e.name}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
      </Modal>

      {/* Mark Item Modal */}
      <Modal isOpen={!!markItem} onClose={() => setMarkItem(null)} title={`Mark Item: ${markItem?.asset_name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setMarkItem(null)}>Cancel</button><button className="btn btn-primary" onClick={handleMarkItem} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Mark'}</button></>}>
        {markItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <span className="asset-tag">{markItem.asset_tag}</span>
              <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{markItem.asset_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{markItem.location || 'No location'}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {['Verified', 'Missing', 'Damaged'].map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: markForm.status === s ? 'rgba(79,142,247,0.15)' : 'var(--bg-input)', border: `1px solid ${markForm.status === s ? 'var(--border-accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
                    <input type="radio" name="mark-status" value={s} checked={markForm.status === s} onChange={() => setMarkForm(f => ({ ...f, status: s }))} style={{ display: 'none' }} />
                    {STATUS_ICONS[s]} {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" value={markForm.notes} onChange={e => setMarkForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional observations..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
