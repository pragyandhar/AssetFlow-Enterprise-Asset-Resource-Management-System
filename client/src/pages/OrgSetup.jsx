import { useState, useEffect } from 'react';
import { Building2, Tag, Users, Plus, Edit2, CheckCircle, XCircle, Loader2, ChevronRight, Shield, User } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

// ──────────────────────────── Departments Tab ────────────────────────────
function DepartmentsTab() {
  const [depts, setDepts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parent_id: '', head_id: '', status: 'Active' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [dRes, eRes] = await Promise.all([api.get('/departments'), api.get('/employees?status=Active')]);
    setDepts(dRes.data.departments);
    setEmployees(eRes.data.employees);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', parent_id: '', head_id: '', status: 'Active' }); setError(''); setShowModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, description: d.description || '', parent_id: d.parent_id || '', head_id: d.head_id || '', status: d.status }); setError(''); setShowModal(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/departments/${editing.id}`, form);
      else await api.post('/departments', form);
      setShowModal(false);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error saving'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div><h3>Departments</h3><p className="text-sm text-muted">{depts.length} department(s)</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Department</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {depts.map(d => (
          <div key={d.id} className="card card-hover" onClick={() => openEdit(d)} style={{ cursor: 'pointer' }}>
            <div className="flex justify-between items-start">
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{d.name}</div>
                {d.parent_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>↳ {d.parent_name}</div>}
                {d.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{d.description}</div>}
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8125rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Head</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.head_name || '—'}</div>
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.employee_count}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Department' : 'Add Department'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : editing ? 'Save Changes' : 'Create'}</button>
          </>
        }>
        {error && <div className="auth-error mb-4">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label required">Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Parent Department</label>
              <select className="form-control" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                <option value="">None (Top Level)</option>
                {depts.filter(d => !editing || d.id !== editing.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Department Head</label>
              <select className="form-control" value={form.head_id} onChange={e => setForm(f => ({ ...f, head_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────── Categories Tab ────────────────────────────
function CategoriesTab() {
  const [cats, setCats] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', custom_fields: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/categories').then(r => { setCats(r.data.categories); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', custom_fields: [] }); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || '', custom_fields: c.custom_fields || [] }); setError(''); setShowModal(true); };

  const addField = () => setForm(f => ({ ...f, custom_fields: [...f.custom_fields, { name: '', label: '', type: 'text' }] }));
  const updateField = (i, key, val) => setForm(f => ({ ...f, custom_fields: f.custom_fields.map((cf, idx) => idx === i ? { ...cf, [key]: val } : cf) }));
  const removeField = (i) => setForm(f => ({ ...f, custom_fields: f.custom_fields.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/categories/${editing.id}`, form);
      else await api.post('/categories', form);
      setShowModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const CATEGORY_ICONS = { Electronics: '💻', Furniture: '🪑', Vehicles: '🚗', 'Rooms & Spaces': '🏢', Equipment: '⚙️' };

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div><h3>Asset Categories</h3><p className="text-sm text-muted">{cats.length} categories</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Category</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {cats.map(c => (
          <div key={c.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => openEdit(c)}>
            <div className="flex items-center gap-3 mb-3">
              <div style={{ fontSize: '1.75rem' }}>{CATEGORY_ICONS[c.name] || '📦'}</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.asset_count} asset(s)</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            {c.description && <p style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{c.description}</p>}
            {c.custom_fields?.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Custom fields: {c.custom_fields.map(cf => cf.label).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'Add Category'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label required">Category Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="form-label" style={{ margin: 0 }}>Custom Fields</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addField}><Plus size={14} /> Add Field</button>
            </div>
            {form.custom_fields.map((cf, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 32px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input className="form-control" placeholder="key" value={cf.name} onChange={e => updateField(i, 'name', e.target.value)} />
                <input className="form-control" placeholder="Label" value={cf.label} onChange={e => updateField(i, 'label', e.target.value)} />
                <select className="form-control" value={cf.type} onChange={e => updateField(i, 'type', e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                </select>
                <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeField(i)}><XCircle size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────── Employees Tab ────────────────────────────
function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ role: '', department_id: '', status: 'Active' });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [eRes, dRes] = await Promise.all([api.get('/employees'), api.get('/departments')]);
    setEmployees(eRes.data.employees);
    setDepartments(dRes.data.departments);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (emp) => {
    setSelected(emp);
    setForm({ role: emp.role, department_id: emp.department_id || '', status: emp.status });
    setError(''); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/employees/${selected.id}`, form);
      setShowModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const filtered = employees.filter(e =>
    (!search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || e.role === roleFilter)
  );

  const ROLE_ICONS = { Admin: <Shield size={14} />, AssetManager: <Tag size={14} />, DepartmentHead: <Building2 size={14} />, Employee: <User size={14} /> };

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div><h3>Employee Directory</h3><p className="text-sm text-muted">{employees.length} employees</p></div>
      </div>

      <div className="filter-bar">
        <div className="table-search">
          <Users size={16} />
          <input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="Admin">Admin</option>
          <option value="AssetManager">Asset Manager</option>
          <option value="DepartmentHead">Department Head</option>
          <option value="Employee">Employee</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={emp.role} /></td>
                  <td>{emp.department_name || '—'}</td>
                  <td><StatusBadge status={emp.status} /></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(emp)}>
                      <Edit2 size={14} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="table-empty">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Manage: ${selected?.name}`}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button></>}>
        {error && <div className="auth-error mb-4">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Employee</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected?.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{selected?.email}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="Employee">Employee</option>
              <option value="DepartmentHead">Department Head</option>
              <option value="AssetManager">Asset Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-control" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────── Main OrgSetup ────────────────────────────
export default function OrgSetup() {
  const [activeTab, setActiveTab] = useState('departments');

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Organization Setup</h1>
          <p className="page-subtitle">Manage departments, asset categories, and employee roles</p>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'departments', label: 'Departments', icon: Building2 },
          { id: 'categories', label: 'Asset Categories', icon: Tag },
          { id: 'employees', label: 'Employee Directory', icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'departments' && <DepartmentsTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'employees' && <EmployeesTab />}
    </div>
  );
}
