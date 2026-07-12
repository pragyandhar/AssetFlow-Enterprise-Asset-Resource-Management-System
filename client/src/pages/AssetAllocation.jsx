import { useState, useEffect } from 'react';
import { Plus, Search, ArrowLeftRight, CheckCircle, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, isPast } from 'date-fns';

export default function AssetAllocation() {
  const { user, canManageAssets, canApprove } = useAuth();
  const [tab, setTab] = useState('allocations');
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllocate, setShowAllocate] = useState(false);
  const [showReturn, setShowReturn] = useState(null);
  const [showTransfer, setShowTransfer] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchStatus, setSearchStatus] = useState('Active');

  const [allocForm, setAllocForm] = useState({ asset_id: '', allocated_to: '', expected_return_date: '' });
  const [returnForm, setReturnForm] = useState({ return_condition: 'Good', return_notes: '' });
  const [transferForm, setTransferForm] = useState({ to_user_id: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, eRes, tRes, assRes] = await Promise.all([
        api.get('/allocations', { params: searchStatus ? { status: searchStatus } : {} }),
        api.get('/employees?status=Active'),
        api.get('/allocations/transfers/list'),
        api.get('/assets?status=Available'),
      ]);
      const today = new Date().toISOString().split('T')[0];
      const allocs = aRes.data.allocations.map(al => ({
        ...al,
        is_overdue: al.status === 'Active' && al.expected_return_date && al.expected_return_date < today
      }));
      setAllocations(allocs);
      setEmployees(eRes.data.employees);
      setTransfers(tRes.data.transfers);
      setAssets(assRes.data.assets);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [searchStatus]);

  const handleAllocate = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setConflictInfo(null);
    try {
      await api.post('/allocations', allocForm);
      setShowAllocate(false);
      setAllocForm({ asset_id: '', allocated_to: '', expected_return_date: '' });
      load();
    } catch (err) {
      const data = err.response?.data;
      if (data?.current_holder) {
        setConflictInfo(data);
      } else {
        setError(data?.error || 'Allocation failed');
      }
    } finally { setSaving(false); }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post(`/allocations/${showReturn.id}/return`, returnForm);
      setShowReturn(null);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Return failed'); }
    finally { setSaving(false); }
  };

  const handleTransferRequest = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/allocations/transfer', { asset_id: showTransfer.asset_id, to_user_id: transferForm.to_user_id, notes: transferForm.notes });
      setShowTransfer(null);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Transfer request failed'); }
    finally { setSaving(false); }
  };

  const handleTransferAction = async (id, status) => {
    try {
      await api.put(`/allocations/transfers/${id}`, { status });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const openTransfer = (al) => {
    setShowTransfer(al);
    setTransferForm({ to_user_id: '', notes: '' });
    setError('');
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Asset Allocations</h1>
          <p className="page-subtitle">Manage asset assignments, transfers, and returns</p>
        </div>
        {canApprove && (
          <button className="btn btn-primary" onClick={() => { setShowAllocate(true); setError(''); setConflictInfo(null); }}>
            <Plus size={16} /> Allocate Asset
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'allocations' ? 'active' : ''}`} onClick={() => setTab('allocations')}><ArrowLeftRight size={16} /> Allocations</button>
        <button className={`tab ${tab === 'transfers' ? 'active' : ''}`} onClick={() => setTab('transfers')}>
          <RefreshCw size={16} /> Transfer Requests
          {transfers.filter(t => t.status === 'Requested').length > 0 && (
            <span className="sidebar-item-badge">{transfers.filter(t => t.status === 'Requested').length}</span>
          )}
        </button>
      </div>

      {tab === 'allocations' && (
        <>
          <div className="filter-bar">
            <select className="filter-select" value={searchStatus} onChange={e => setSearchStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Returned">Returned</option>
              <option value="TransferRequested">Transfer Requested</option>
            </select>
          </div>

          <div className="table-container">
            <div className="table-responsive">
              {loading ? <div className="loading-container"><div className="loading-spinner" /></div> : (
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Holder</th>
                      <th>Department</th>
                      <th>Expected Return</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(al => (
                      <tr key={al.id} className={al.is_overdue ? 'overdue-row' : ''}>
                        <td>
                          <span className="asset-tag">{al.asset_tag}</span>
                          <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{al.asset_name}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{al.allocated_to_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{al.allocated_to_email}</div>
                        </td>
                        <td>{al.department_name || '—'}</td>
                        <td>
                          {al.expected_return_date ? (
                            <span style={{ color: al.is_overdue ? 'var(--danger)' : 'var(--text-secondary)' }}>
                              {al.is_overdue && <AlertTriangle size={13} style={{ marginRight: '0.25rem' }} />}
                              {al.expected_return_date}
                            </span>
                          ) : '—'}
                        </td>
                        <td><StatusBadge status={al.is_overdue ? 'Overdue' : al.status} /></td>
                        <td>
                          <div className="table-actions">
                            {(al.status === 'Active' || al.status === 'Overdue') && (
                              <>
                                {(canApprove || al.allocated_to === user?.id) && (
                                  <button className="btn btn-success btn-sm" onClick={() => { setShowReturn(al); setReturnForm({ return_condition: 'Good', return_notes: '' }); setError(''); }}>
                                    <CheckCircle size={14} /> Return
                                  </button>
                                )}
                                <button className="btn btn-secondary btn-sm" onClick={() => openTransfer(al)}>
                                  <ArrowLeftRight size={14} /> Transfer
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {allocations.length === 0 && (
                      <tr><td colSpan={6}><div className="empty-state"><ArrowLeftRight size={40} className="empty-state-icon" /><div className="empty-state-title">No allocations found</div></div></td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'transfers' && (
        <div className="table-container">
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Asset</th><th>From</th><th>To</th><th>Requested By</th><th>Status</th>{canApprove && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {transfers.map(tr => (
                  <tr key={tr.id}>
                    <td><span className="asset-tag">{tr.asset_tag}</span><div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{tr.asset_name}</div></td>
                    <td>{tr.from_user_name}</td>
                    <td>{tr.to_user_name}</td>
                    <td>{tr.requested_by_name}</td>
                    <td><StatusBadge status={tr.status} /></td>
                    {canApprove && (
                      <td>
                        {tr.status === 'Requested' && (
                          <div className="table-actions">
                            <button className="btn btn-success btn-sm" onClick={() => handleTransferAction(tr.id, 'Approved')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleTransferAction(tr.id, 'Rejected')}>Reject</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={canApprove ? 6 : 5}><div className="empty-state"><RefreshCw size={40} className="empty-state-icon" /><div className="empty-state-title">No transfer requests</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      <Modal isOpen={showAllocate} onClose={() => setShowAllocate(false)} title="Allocate Asset"
        footer={<><button className="btn btn-secondary" onClick={() => setShowAllocate(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAllocate} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Allocate'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        {conflictInfo && (
          <div className="alert alert-warning mb-4">
            <AlertTriangle size={16} className="alert-icon" />
            <div>
              <div className="alert-title">Conflict Detected</div>
              <div className="alert-message">{conflictInfo.error}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label required">Available Asset</label>
            <select className="form-control" value={allocForm.asset_id} onChange={e => setAllocForm(f => ({ ...f, asset_id: e.target.value }))} required>
              <option value="">Select available asset...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Allocate To</label>
            <select className="form-control" value={allocForm.allocated_to} onChange={e => setAllocForm(f => ({ ...f, allocated_to: e.target.value }))} required>
              <option value="">Select employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department_name || 'No dept'})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expected Return Date</label>
            <input type="date" className="form-control" value={allocForm.expected_return_date} onChange={e => setAllocForm(f => ({ ...f, expected_return_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal isOpen={!!showReturn} onClose={() => setShowReturn(null)} title="Return Asset"
        footer={<><button className="btn btn-secondary" onClick={() => setShowReturn(null)}>Cancel</button><button className="btn btn-success" onClick={handleReturn} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Confirm Return'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        {showReturn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600 }}>{showReturn.asset_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{showReturn.asset_tag} · Held by {showReturn.allocated_to_name}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Return Condition</label>
              <select className="form-control" value={returnForm.return_condition} onChange={e => setReturnForm(f => ({ ...f, return_condition: e.target.value }))}>
                {['New', 'Good', 'Fair', 'Poor', 'Damaged'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Return Notes</label>
              <textarea className="form-control" value={returnForm.return_notes} onChange={e => setReturnForm(f => ({ ...f, return_notes: e.target.value }))} placeholder="Describe any damage or notes about the asset condition..." rows={3} />
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={!!showTransfer} onClose={() => setShowTransfer(null)} title="Request Transfer"
        footer={<><button className="btn btn-secondary" onClick={() => setShowTransfer(null)}>Cancel</button><button className="btn btn-primary" onClick={handleTransferRequest} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Request Transfer'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        {showTransfer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600 }}>{showTransfer.asset_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Currently held by {showTransfer.allocated_to_name}</div>
            </div>
            <div className="form-group">
              <label className="form-label required">Transfer To</label>
              <select className="form-control" value={transferForm.to_user_id} onChange={e => setTransferForm(f => ({ ...f, to_user_id: e.target.value }))} required>
                <option value="">Select employee...</option>
                {employees.filter(e => e.id !== showTransfer.allocated_to).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Notes</label>
              <textarea className="form-control" value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
