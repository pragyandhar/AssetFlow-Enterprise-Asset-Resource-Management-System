import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Filter, Activity } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { format, parseISO } from 'date-fns';

const NOTIF_ICONS = {
  AssetAssigned: { icon: '📦', color: 'var(--accent-primary)', bg: 'rgba(79,142,247,0.1)' },
  AssetReturned: { icon: '↩️', color: 'var(--success)', bg: 'var(--success-bg)' },
  MaintenanceApproved: { icon: '✅', color: 'var(--success)', bg: 'var(--success-bg)' },
  MaintenanceRejected: { icon: '❌', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  MaintenanceRequested: { icon: '🔧', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  MaintenanceResolved: { icon: '🏆', color: 'var(--success)', bg: 'var(--success-bg)' },
  BookingConfirmed: { icon: '📅', color: 'var(--purple)', bg: 'var(--purple-bg)' },
  BookingCancelled: { icon: '🚫', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  TransferApproved: { icon: '🔄', color: 'var(--success)', bg: 'var(--success-bg)' },
  TransferRejected: { icon: '🚫', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  TransferRequested: { icon: '↔️', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  AuditAssigned: { icon: '🔍', color: 'var(--info)', bg: 'var(--info-bg)' },
  AuditDiscrepancy: { icon: '⚠️', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  RoleChanged: { icon: '⭐', color: 'var(--purple)', bg: 'var(--purple-bg)' },
};

const LOG_ICONS = {
  CREATE: '✨', ALLOCATE: '🔗', RETURN: '↩️', BOOK: '📅',
  MAINTENANCE_REQUEST: '🔧', MAINTENANCE_APPROVED: '✅', MAINTENANCE_REJECTED: '❌',
  TRANSFER_REQUEST: '↔️', TRANSFER_APPROVE: '✅', TRANSFER_REJECT: '❌',
  SIGNUP: '👤', UPDATE: '📝', PROMOTE: '⭐', CANCEL_BOOKING: '🚫',
  MAINTENANCE_RESOLVED: '🏆', CLOSE_AUDIT: '🔒', AUDIT_MARK: '🔍',
  MAINTENANCE_INPROGRESS: '⚙️', MAINTENANCE_TECHASSIGNED: '👨‍🔧',
};

export default function ActivityLogs() {
  const { user, isAdmin, canManageAssets } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, fetchNotifications } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [tab, setTab] = useState('notifications');
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications();
    if (canManageAssets) {
      setLoadingLogs(true);
      api.get('/logs').then(r => {
        const parsed = r.data.logs.map(l => ({ ...l, details: typeof l.details === 'string' ? JSON.parse(l.details || '{}') : (l.details || {}) }));
        setLogs(parsed);
      }).finally(() => setLoadingLogs(false));
    }
  }, []);

  const displayed = unreadOnly ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Activity & Notifications</h1>
          <p className="page-subtitle">Stay informed on all asset events and system activities</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}>
            <CheckCheck size={16} /> Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}>
          <Bell size={16} /> Notifications
          {unreadCount > 0 && <span className="sidebar-item-badge">{unreadCount}</span>}
        </button>
        {canManageAssets && (
          <button className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
            <Activity size={16} /> Activity Logs
          </button>
        )}
      </div>

      {tab === 'notifications' && (
        <div>
          <div className="filter-bar mb-4">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />
              Show unread only
            </label>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{displayed.length} notification(s)</span>
          </div>

          {displayed.length === 0 ? (
            <div className="empty-state">
              <Bell size={48} className="empty-state-icon" />
              <div className="empty-state-title">No notifications</div>
              <div className="empty-state-desc">{unreadOnly ? 'All caught up!' : 'You have no notifications yet.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {displayed.map(notif => {
                const config = NOTIF_ICONS[notif.type] || { icon: '📋', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' };
                return (
                  <div key={notif.id} className={`notification-item ${!notif.is_read ? 'unread' : ''}`} onClick={() => !notif.is_read && markRead(notif.id)}>
                    <div className="notification-icon" style={{ background: config.bg, color: config.color, fontSize: '1.125rem' }}>
                      {config.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.125rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{notif.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {format(parseISO(notif.created_at), 'MMM d, HH:mm')}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{notif.message}</div>
                    </div>
                    {!notif.is_read && <div className="notification-dot" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && canManageAssets && (
        <div className="table-container">
          <div className="table-responsive">
            {loadingLogs ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : (
              <table>
                <thead>
                  <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {format(parseISO(log.created_at), 'MMM d, HH:mm')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.user_name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{LOG_ICONS[log.action] || '📋'}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{log.action.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-muted">{log.entity_type}</span>
                        {log.entity_id && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>#{log.entity_id}</span>}
                      </td>
                      <td>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={5}><div className="empty-state"><Activity size={40} className="empty-state-icon" /><div className="empty-state-title">No activity yet</div></div></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
