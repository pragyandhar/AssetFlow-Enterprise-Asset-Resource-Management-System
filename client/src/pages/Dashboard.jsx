import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Users, Wrench, CalendarDays, ArrowLeftRight,
  Clock, AlertTriangle, Plus, Box, TrendingUp, Activity
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { format, parseISO } from 'date-fns';

function KPICard({ icon: Icon, label, value, sublabel, color, onClick }) {
  return (
    <div className={`kpi-card ${color} ${onClick ? 'card-hover' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className={`kpi-icon ${color}`}><Icon size={20} /></div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sublabel && <div className="kpi-sublabel">{sublabel}</div>}
      </div>
    </div>
  );
}

const ACTION_ICONS = {
  CREATE: '✨', ALLOCATE: '🔗', RETURN: '↩️', BOOK: '📅',
  MAINTENANCE_REQUEST: '🔧', MAINTENANCE_APPROVED: '✅', TRANSFER_REQUEST: '↔️',
  SIGNUP: '👤', UPDATE: '📝', PROMOTE: '⭐', CANCEL_BOOKING: '❌',
  MAINTENANCE_RESOLVED: '🏆', CLOSE_AUDIT: '🔒', AUDIT_MARK: '🔍',
};

export default function Dashboard() {
  const { user, canManageAssets } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard-kpis').then(({ data }) => {
      setKpis(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-container"><div className="loading-spinner" /></div>
  );

  const { kpis: k, overdueAllocations, recentActivity } = kpis || {};

  return (
    <div className="animate-fadeIn">
      {/* Hero */}
      <div className="dashboard-hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
              Here's your organization's asset status at a glance — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {canManageAssets && (
              <button className="btn btn-primary" onClick={() => navigate('/assets')}>
                <Plus size={16} /> Register Asset
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/bookings')}>
              <CalendarDays size={16} /> Book Resource
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/maintenance')}>
              <Wrench size={16} /> Maintenance
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid mb-6">
        <KPICard icon={Box} label="Assets Available" value={k?.assets_available ?? 0} color="green" onClick={() => navigate('/assets?status=Available')} />
        <KPICard icon={ArrowLeftRight} label="Assets Allocated" value={k?.assets_allocated ?? 0} color="blue" onClick={() => navigate('/allocations')} />
        <KPICard icon={Wrench} label="Maintenance Active" value={k?.maintenance_today ?? 0} color="amber" onClick={() => navigate('/maintenance')} />
        <KPICard icon={CalendarDays} label="Active Bookings" value={k?.active_bookings ?? 0} color="purple" onClick={() => navigate('/bookings')} />
        <KPICard icon={ArrowLeftRight} label="Pending Transfers" value={k?.pending_transfers ?? 0} color="cyan" onClick={() => navigate('/allocations')} />
        <KPICard icon={Clock} label="Upcoming Returns" value={k?.upcoming_returns ?? 0} sublabel={`${k?.overdue_returns ?? 0} overdue`} color={k?.overdue_returns > 0 ? 'red' : 'green'} onClick={() => navigate('/allocations')} />
      </div>

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Overdue Returns */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-2">
                <AlertTriangle size={18} color="var(--danger)" /> Overdue Returns
              </div>
              <div className="card-subtitle">{overdueAllocations?.length || 0} allocation(s) past due date</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/allocations')}>View All</button>
          </div>
          {overdueAllocations?.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem' }}>🎉</div>
              <div className="empty-state-title">No Overdue Returns</div>
              <div className="empty-state-desc">All allocations are on track.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {overdueAllocations?.slice(0, 5).map(al => (
                <div key={al.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{al.asset_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Held by {al.holder_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="asset-tag">{al.asset_tag}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                      Due: {al.expected_return_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title flex items-center gap-2">
                <Activity size={18} color="var(--accent-primary)" /> Recent Activity
              </div>
              <div className="card-subtitle">Latest system actions</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/activity')}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentActivity?.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '2rem' }}>No recent activity</div>
            ) : recentActivity?.slice(0, 8).map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s' }}>
                <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>{ACTION_ICONS[log.action] || '📋'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {log.user_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{log.action.toLowerCase().replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {log.entity_type} · {format(parseISO(log.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
