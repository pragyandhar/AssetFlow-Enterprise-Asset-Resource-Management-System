import { useState, useEffect } from 'react';
import { Plus, Wrench, CheckCircle, XCircle, User, Loader2, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

const WORKFLOW_STEPS = ['Pending', 'Approved', 'TechAssigned', 'InProgress', 'Resolved'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function WorkflowPipeline({ status }) {
  const idx = WORKFLOW_STEPS.indexOf(status);
  const isRejected = status === 'Rejected';
  return (
    <div className="pipeline" style={{ padding: '0.5rem 0' }}>
      {WORKFLOW_STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <div className={`pipeline-node ${isRejected && step === 'Approved' ? 'rejected' : i < idx ? 'done' : i === idx ? 'active' : ''}`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <div className={`pipeline-label ${i === idx ? 'active' : ''}`} style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
              {step === 'TechAssigned' ? 'Assigned' : step}
            </div>
          </div>
          {i < WORKFLOW_STEPS.length - 1 && (
            <div className={`pipeline-connector ${i < idx - 1 ? 'done' : i === idx - 1 ? 'active' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Maintenance() {
  const { user, canManageAssets } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ asset_id: '', description: '', priority: 'Medium' });
  const [actionForm, setActionForm] = useState({ status: '', technician_id: '', technician_notes: '', resolution_notes: '' });

  const load = async () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    const [rRes, aRes, eRes] = await Promise.all([
      api.get('/maintenance', { params }),
      api.get('/assets'),
      api.get('/employees?status=Active'),
    ]);
    setRequests(rRes.data.requests);
    setAssets(aRes.data.assets);
    setEmployees(eRes.data.employees);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, priorityFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/maintenance', form);
      setShowCreate(false);
      setForm({ asset_id: '', description: '', priority: 'Medium' });
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleAction = async (id, updates) => {
    setSaving(true); setError('');
    try {
      await api.put(`/maintenance/${id}`, updates);
      const { data } = await api.get('/maintenance');
      setRequests(data.requests);
      const updated = data.requests.find(r => r.id === id);
      if (updated) setShowDetail(updated);
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const PRIORITY_COLORS = { Low: 'var(--text-muted)', Medium: 'var(--warning)', High: 'var(--danger)', Critical: '#ff2d55' };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Maintenance Management</h1>
          <p className="page-subtitle">Route repair requests through approval workflow before work begins</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}>
          <Plus size={16} /> Raise Request
        </button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Pending', 'Approved', 'Rejected', 'TechAssigned', 'InProgress', 'Resolved'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state"><Wrench size={48} className="empty-state-icon" /><div className="empty-state-title">No maintenance requests</div></div>
        ) : requests.map(req => (
          <div key={req.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setShowDetail(req)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="asset-tag">{req.asset_tag}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.asset_name}</span>
                  <StatusBadge status={req.priority} />
                  <StatusBadge status={req.status} />
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{req.description}</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Raised by {req.requested_by_name} · {format(parseISO(req.created_at), 'MMM d, yyyy HH:mm')}
                  {req.approved_by_name && ` · Approved by ${req.approved_by_name}`}
                </div>
              </div>
              <div style={{ minWidth: 300 }}>
                <WorkflowPipeline status={req.status} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Raise Maintenance Request"
        footer={<><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Submit Request'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label required">Asset</label>
            <select className="form-control" value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))} required>
              <option value="">Select asset...</option>
              {assets.filter(a => !['Retired', 'Disposed'].includes(a.status)).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Priority</label>
            <select className="form-control" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Issue Description</label>
            <textarea className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the issue in detail..." required />
          </div>
        </div>
      </Modal>

      {/* Detail/Action Modal */}
      <Modal isOpen={!!showDetail} onClose={() => { setShowDetail(null); setError(''); }} title="Maintenance Request" size="lg">
        {showDetail && (
          <div>
            {error && <div className="auth-error mb-4">{error}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className="asset-tag">{showDetail.asset_tag}</span>
              <StatusBadge status={showDetail.status} />
              <StatusBadge status={showDetail.priority} />
            </div>

            <h3 style={{ marginBottom: '0.5rem' }}>{showDetail.asset_name}</h3>

            <div style={{ padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Issue Description</div>
              <div style={{ color: 'var(--text-primary)' }}>{showDetail.description}</div>
            </div>

            <WorkflowPipeline status={showDetail.status} />

            <div style={{ marginTop: '1rem', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Raised by <strong style={{ color: 'var(--text-primary)' }}>{showDetail.requested_by_name}</strong> on {format(parseISO(showDetail.created_at), 'MMM d, yyyy')}
              {showDetail.approved_by_name && <> · Approved by <strong style={{ color: 'var(--text-primary)' }}>{showDetail.approved_by_name}</strong></>}
              {showDetail.technician_name && <> · Technician: <strong style={{ color: 'var(--text-primary)' }}>{showDetail.technician_name}</strong></>}
            </div>

            {showDetail.technician_notes && (
              <div style={{ padding: '0.75rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <strong>Technician Notes:</strong> {showDetail.technician_notes}
              </div>
            )}
            {showDetail.resolution_notes && (
              <div style={{ padding: '0.75rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--success)' }}>
                <strong>Resolution:</strong> {showDetail.resolution_notes}
              </div>
            )}

            {/* Action buttons */}
            {canManageAssets && showDetail.status === 'Pending' && (
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-success" disabled={saving} onClick={() => handleAction(showDetail.id, { status: 'Approved' })}>
                  <CheckCircle size={16} /> Approve
                </button>
                <button className="btn btn-danger" disabled={saving} onClick={() => handleAction(showDetail.id, { status: 'Rejected' })}>
                  <XCircle size={16} /> Reject
                </button>
              </div>
            )}

            {canManageAssets && showDetail.status === 'Approved' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label className="form-label">Assign Technician</label>
                  <select className="form-control" id="tech-select" onChange={e => {}}>
                    <option value="">Select technician...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Technician Notes</label>
                  <textarea className="form-control" id="tech-notes" rows={2} placeholder="Assignment details..." />
                </div>
                <button className="btn btn-primary" disabled={saving} onClick={() => {
                  const techId = document.getElementById('tech-select').value;
                  const notes = document.getElementById('tech-notes').value;
                  handleAction(showDetail.id, { status: 'TechAssigned', technician_id: techId || undefined, technician_notes: notes || undefined });
                }}>
                  <User size={16} /> Assign Technician
                </button>
              </div>
            )}

            {canManageAssets && (showDetail.status === 'TechAssigned' || showDetail.status === 'InProgress') && (
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                {showDetail.status === 'TechAssigned' && (
                  <button className="btn btn-secondary" disabled={saving} onClick={() => handleAction(showDetail.id, { status: 'InProgress' })}>
                    Mark In Progress
                  </button>
                )}
                <div style={{ flex: 1 }}>
                  <textarea className="form-control" id="resolution-notes" rows={2} placeholder="Resolution details..." style={{ marginBottom: '0.5rem' }} />
                  <button className="btn btn-success w-full" disabled={saving} onClick={() => {
                    const notes = document.getElementById('resolution-notes').value;
                    handleAction(showDetail.id, { status: 'Resolved', resolution_notes: notes });
                  }}>
                    <CheckCircle size={16} /> Mark Resolved
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
